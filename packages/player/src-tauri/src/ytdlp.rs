use log::{debug, error};
use std::process::{Command, Stdio};
use std::sync::RwLock;
use tauri::command;

static YTDLP_PATH: RwLock<Option<String>> = RwLock::new(None);

pub fn set_ytdlp_path(path: String) {
    if let Ok(mut guard) = YTDLP_PATH.write() {
        debug!("[yt-dlp] Binary path set to: {}", path);
        *guard = Some(path);
    }
}

fn get_ytdlp_path() -> Result<String, String> {
    match YTDLP_PATH.read() {
        Ok(guard) => match guard.as_ref() {
            Some(path) => Ok(path.clone()),
            None => {
                Err("yt-dlp is not installed. It will be downloaded automatically.".to_string())
            }
        },
        Err(_) => {
            debug!("[yt-dlp] RwLock poisoned, falling back to system PATH");
            Ok("yt-dlp".to_string())
        }
    }
}

#[derive(serde::Serialize, Debug, PartialEq, specta::Type)]
pub struct YtdlpStreamInfo {
    pub stream_url: String,
    pub duration: Option<f64>,
    pub title: Option<String>,
    pub container: Option<String>,
    pub codec: Option<String>,
    pub album: Option<String>,
    pub artists: Vec<String>,
    pub album_artists: Vec<String>,
    pub upload_date: Option<String>,
}

#[derive(serde::Serialize, Debug, PartialEq, specta::Type)]
pub struct YtdlpSearchResult {
    pub id: String,
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, specta::Type)]
pub struct YtdlpThumbnail {
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(serde::Serialize, Debug, PartialEq, specta::Type)]
pub struct YtdlpPlaylistEntry {
    pub id: String,
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnails: Vec<YtdlpThumbnail>,
    pub channel: Option<String>,
}

#[derive(serde::Serialize, Debug, PartialEq, specta::Type)]
pub struct YtdlpPlaylistInfo {
    pub id: String,
    pub title: String,
    pub entries: Vec<YtdlpPlaylistEntry>,
}

#[derive(serde::Deserialize)]
struct YtdlpJson {
    id: Option<String>,
    title: Option<String>,
    duration: Option<f64>,
    url: Option<String>,
    thumbnail: Option<String>,
    thumbnails: Option<Vec<YtdlpThumbnail>>,
    ext: Option<String>,
    acodec: Option<String>,
    playlist_title: Option<String>,
    playlist_id: Option<String>,
    channel: Option<String>,
    album: Option<String>,
    artist: Option<String>,
    artists: Option<Vec<String>>,
    album_artist: Option<String>,
    album_artists: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    upload_date: Option<String>,
}

fn run_ytdlp(args: &[&str]) -> Result<String, String> {
    let program = get_ytdlp_path()?;
    let mut cmd = Command::new(&program);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().map_err(|error| {
        error!("[yt-dlp] Failed to execute: {}", error);
        format!("Failed to execute yt-dlp: {}. Is yt-dlp installed?", error)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("[yt-dlp] Command failed: {}", stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn parse_ndjson_entries(stdout: &str) -> Vec<YtdlpJson> {
    stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<YtdlpJson>(line).ok())
        .collect()
}

fn normalize_artists(info: &YtdlpJson) -> Vec<String> {
    info.artists
        .clone()
        .or_else(|| info.creators.clone())
        .or_else(|| info.artist.as_ref().map(|a| vec![a.clone()]))
        .unwrap_or_default()
}

fn normalize_album_artists(info: &YtdlpJson) -> Vec<String> {
    info.album_artists
        .clone()
        .or_else(|| info.album_artist.as_ref().map(|a| vec![a.clone()]))
        .unwrap_or_default()
}

async fn search_youtube_innertube(
    query: &str,
    limit: u32,
) -> Result<Vec<YtdlpSearchResult>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|error| error.to_string())?;

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240101.00.00"
            }
        },
        "query": query
    });

    let response = client
        .post("https://www.youtube.com/youtubei/v1/search")
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("InnerTube search request failed: {error}"))?;

    let value: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;

    let mut results = Vec::new();
    if let Some(contents) = value
        .pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(|contents_value| contents_value.as_array())
    {
        for section in contents {
            if let Some(items) = section.pointer("/itemSectionRenderer/contents").and_then(|items_value| items_value.as_array()) {
                for item in items {
                    if let Some(video) = item.get("videoRenderer") {
                        if let Some(id) = video.get("videoId").and_then(|video_id| video_id.as_str()) {
                            let title = video
                                .pointer("/title/runs/0/text")
                                .or_else(|| video.pointer("/title/simpleText"))
                                .and_then(|title_text| title_text.as_str())
                                .unwrap_or("Unknown")
                                .to_string();

                            let duration = video
                                .pointer("/lengthText/simpleText")
                                .and_then(|length_text| length_text.as_str())
                                .and_then(|duration_str| {
                                    let parts: Vec<&str> = duration_str.split(':').collect();
                                    match parts.len() {
                                        3 => {
                                            let hours: f64 = parts[0].parse().ok()?;
                                            let minutes: f64 = parts[1].parse().ok()?;
                                            let seconds: f64 = parts[2].parse().ok()?;
                                            Some(hours * 3600.0 + minutes * 60.0 + seconds)
                                        }
                                        2 => {
                                            let minutes: f64 = parts[0].parse().ok()?;
                                            let seconds: f64 = parts[1].parse().ok()?;
                                            Some(minutes * 60.0 + seconds)
                                        }
                                        1 => parts[0].parse().ok(),
                                        _ => None,
                                    }
                                });

                            let thumbnail = video
                                .pointer("/thumbnail/thumbnails")
                                .and_then(|thumbnails_value| thumbnails_value.as_array())
                                .and_then(|thumbnails_array| thumbnails_array.last())
                                .and_then(|thumbnail_item| thumbnail_item.get("url"))
                                .and_then(|url_str| url_str.as_str())
                                .map(|url_value| url_value.to_string());

                            let channel = video
                                .pointer("/ownerText/runs/0/text")
                                .and_then(|channel_text| channel_text.as_str())
                                .map(|channel_value| channel_value.to_string());

                            results.push(YtdlpSearchResult {
                                id: id.to_string(),
                                title,
                                duration,
                                thumbnail,
                                channel,
                            });

                            if results.len() >= limit as usize {
                                return Ok(results);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

async fn resolve_stream_invidious(video_id: &str) -> Result<YtdlpStreamInfo, String> {
    let instances = [
        "https://invidious.f5.si",
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://yt.artemislena.eu",
        "https://invidious.private.coffee",
    ];

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(7))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|error| error.to_string())?;

    for instance in instances {
        let url = format!("{instance}/api/v1/videos/{video_id}");
        if let Ok(response) = client.get(&url).send().await {
            if response.status().is_success() {
                if let Ok(value) = response.json::<serde_json::Value>().await {
                    let title = value.get("title").and_then(|title_value| title_value.as_str()).map(|title_string| title_string.to_string());
                    let duration = value.get("lengthSeconds").and_then(|duration_val| {
                        duration_val.as_f64().or_else(|| duration_val.as_str()?.parse().ok())
                    });
                    let author = value.get("author").and_then(|author_val| author_val.as_str()).map(|author_string| author_string.to_string());
                    let artists = author.clone().map(|single_author| vec![single_author]).unwrap_or_default();

                    if let Some(formats) = value.get("adaptiveFormats").and_then(|formats_val| formats_val.as_array()) {
                        let mut audio_formats: Vec<&serde_json::Value> = formats
                            .iter()
                            .filter(|format_item| {
                                format_item.get("type").and_then(|type_val| type_val.as_str()).is_some_and(|type_str| type_str.contains("audio"))
                            })
                            .collect();

                        audio_formats.sort_by_key(|format_item| {
                            format_item.get("bitrate").and_then(|bitrate_val| bitrate_val.as_u64()).unwrap_or(0)
                        });

                        if let Some(best) = audio_formats.last() {
                            if let Some(stream_url) = best.get("url").and_then(|url_val| url_val.as_str()) {
                                let container = best.get("container").and_then(|container_val| container_val.as_str()).map(|container_str| container_str.to_string()).or_else(|| Some("m4a".to_string()));
                                let codec = best.get("encoding").and_then(|codec_val| codec_val.as_str()).map(|codec_str| codec_str.to_string());

                                return Ok(YtdlpStreamInfo {
                                    stream_url: stream_url.to_string(),
                                    duration,
                                    title,
                                    container,
                                    codec,
                                    album: None,
                                    artists: artists.clone(),
                                    album_artists: artists,
                                    upload_date: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Err(format!("Could not resolve audio stream for video {video_id}"))
}

#[command]
#[specta::specta]
pub async fn ytdlp_search(
    query: String,
    max_results: Option<u32>,
) -> Result<Vec<YtdlpSearchResult>, String> {
    let limit = max_results.unwrap_or(10);
    debug!("[yt-dlp] Searching: {} (limit: {})", query, limit);

    let search_url = format!("ytsearch{}:{}", limit, query);
    if let Ok(stdout) = run_ytdlp(&[
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        &search_url,
    ]) {
        let results: Vec<YtdlpSearchResult> = parse_ndjson_entries(&stdout)
            .into_iter()
            .filter_map(|entry| {
                entry.id.map(|id| YtdlpSearchResult {
                    id,
                    title: entry.title.unwrap_or_else(|| "Unknown".to_string()),
                    duration: entry.duration,
                    thumbnail: entry.thumbnail.or_else(|| {
                        entry
                            .thumbnails
                            .unwrap_or_default()
                            .last()
                            .map(|thumbnail| thumbnail.url.clone())
                    }),
                    channel: entry.channel,
                })
            })
            .collect();

        if !results.is_empty() {
            debug!("[yt-dlp] Found {} results", results.len());
            return Ok(results);
        }
    }

    debug!("[yt-dlp] Falling back to InnerTube search for: {}", query);
    search_youtube_innertube(&query, limit).await
}

#[command]
#[specta::specta]
pub async fn ytdlp_get_stream(
    url: Option<String>,
    video_id: Option<String>,
) -> Result<YtdlpStreamInfo, String> {
    let resolved_url = match (&url, &video_id) {
        (Some(stream_url), _) => stream_url.clone(),
        (None, Some(id)) => format!("https://www.youtube.com/watch?v={id}"),
        (None, None) => return Err("Either url or video_id must be provided".to_string()),
    };

    let video_identifier = video_id.clone().or_else(|| {
        url.as_ref().and_then(|raw_url| {
            if raw_url.contains("v=") {
                raw_url.split("v=").nth(1)?.split('&').next().map(|s| s.to_string())
            } else if raw_url.len() == 11 {
                Some(raw_url.clone())
            } else {
                None
            }
        })
    });

    debug!("[yt-dlp] Getting stream for: {}", resolved_url);

    if let Ok(stdout) = run_ytdlp(&[
        "-f",
        "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        &resolved_url,
    ]) {
        if let Ok(info) = serde_json::from_str::<YtdlpJson>(&stdout) {
            if let Some(ref stream_url) = info.url {
                let artists = normalize_artists(&info);
                let album_artists = normalize_album_artists(&info);

                debug!(
                    "[yt-dlp] Got stream for '{}', duration: {:?}s",
                    info.title.as_deref().unwrap_or("Unknown"),
                    info.duration
                );

                return Ok(YtdlpStreamInfo {
                    stream_url: stream_url.clone(),
                    duration: info.duration,
                    title: info.title,
                    container: info.ext,
                    codec: info.acodec,
                    album: info.album,
                    artists,
                    album_artists,
                    upload_date: info.upload_date,
                });
            }
        }
    }

    if let Some(id) = video_identifier {
        return Ok(YtdlpStreamInfo {
            stream_url: format!("https://www.youtube.com/watch?v={id}"),
            duration: None,
            title: None,
            container: Some("youtube".to_string()),
            codec: Some("youtube".to_string()),
            album: None,
            artists: Vec::new(),
            album_artists: Vec::new(),
            upload_date: None,
        });
    }

    Err("Could not resolve stream URL".to_string())
}

#[command]
#[specta::specta]
pub async fn ytdlp_get_playlist(url: String) -> Result<YtdlpPlaylistInfo, String> {
    debug!("[yt-dlp] Getting playlist: {}", url);

    let stdout = run_ytdlp(&["--dump-json", "--flat-playlist", "--no-warnings", &url])?;
    let entries_json = parse_ndjson_entries(&stdout);

    let playlist_title = entries_json
        .iter()
        .find_map(|entry| entry.playlist_title.clone())
        .ok_or_else(|| {
            error!("[yt-dlp] No playlist metadata found in output");
            "No playlist metadata found in yt-dlp output".to_string()
        })?;

    let playlist_id = entries_json
        .iter()
        .find_map(|entry| entry.playlist_id.clone())
        .unwrap_or_default();

    let entries: Vec<YtdlpPlaylistEntry> = entries_json
        .into_iter()
        .filter_map(|entry| {
            entry.id.map(|id| YtdlpPlaylistEntry {
                id,
                title: entry.title.unwrap_or_else(|| "Unknown".to_string()),
                duration: entry.duration,
                thumbnails: entry.thumbnails.unwrap_or_default(),
                channel: entry.channel,
            })
        })
        .collect();

    debug!(
        "[yt-dlp] Playlist '{}' has {} entries",
        playlist_title,
        entries.len()
    );

    Ok(YtdlpPlaylistInfo {
        id: playlist_id,
        title: playlist_title,
        entries,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_json() -> YtdlpJson {
        YtdlpJson {
            id: None,
            title: None,
            duration: None,
            url: None,
            thumbnail: None,
            thumbnails: None,
            ext: None,
            acodec: None,
            playlist_title: None,
            playlist_id: None,
            channel: None,
            album: None,
            artist: None,
            artists: None,
            album_artist: None,
            album_artists: None,
            creators: None,
            upload_date: None,
        }
    }

    mod parse_ndjson {
        use super::*;

        #[test]
        fn parses_multiple_lines() {
            let input = r#"{"id":"v1","title":"First"}
{"id":"v2","title":"Second"}"#;

            let results = parse_ndjson_entries(input);

            assert_eq!(results.len(), 2);
            assert_eq!(results[0].id.as_deref(), Some("v1"));
            assert_eq!(results[1].id.as_deref(), Some("v2"));
        }

        #[test]
        fn skips_malformed_lines() {
            let input = r#"{"id":"good"}
not json
{"id":"also_good"}"#;

            let results = parse_ndjson_entries(input);

            assert_eq!(results.len(), 2);
        }

        #[test]
        fn skips_empty_lines() {
            let input = "\n{\"id\":\"v1\"}\n\n{\"id\":\"v2\"}\n";

            let results = parse_ndjson_entries(input);

            assert_eq!(results.len(), 2);
        }

        #[test]
        fn returns_empty_vec_for_empty_input() {
            assert!(parse_ndjson_entries("").is_empty());
            assert!(parse_ndjson_entries("\n\n").is_empty());
        }
    }

    mod normalize_artists_tests {
        use super::*;

        #[test]
        fn prefers_artists_over_creators() {
            let json = YtdlpJson {
                artists: Some(vec!["Rick Astley".into()]),
                creators: Some(vec!["Someone Else".into()]),
                ..empty_json()
            };
            assert_eq!(normalize_artists(&json), vec!["Rick Astley"]);
        }

        #[test]
        fn falls_back_to_creators() {
            let json = YtdlpJson {
                creators: Some(vec!["Performer 1".into(), "Performer 2".into()]),
                ..empty_json()
            };
            assert_eq!(
                normalize_artists(&json),
                vec!["Performer 1", "Performer 2"]
            );
        }

        #[test]
        fn falls_back_to_artist_string() {
            let json = YtdlpJson {
                artist: Some("Solo Artist".into()),
                ..empty_json()
            };
            assert_eq!(normalize_artists(&json), vec!["Solo Artist"]);
        }

        #[test]
        fn returns_empty_when_all_null() {
            assert!(normalize_artists(&empty_json()).is_empty());
        }
    }

    mod normalize_album_artists_tests {
        use super::*;

        #[test]
        fn prefers_album_artists_over_album_artist() {
            let json = YtdlpJson {
                album_artists: Some(vec!["Group A".into(), "Group B".into()]),
                album_artist: Some("Ignored".into()),
                ..empty_json()
            };
            assert_eq!(
                normalize_album_artists(&json),
                vec!["Group A", "Group B"]
            );
        }

        #[test]
        fn wraps_album_artist_string_in_vec() {
            let json = YtdlpJson {
                album_artist: Some("The Band".into()),
                ..empty_json()
            };
            assert_eq!(normalize_album_artists(&json), vec!["The Band"]);
        }

        #[test]
        fn returns_empty_when_all_null() {
            assert!(normalize_album_artists(&empty_json()).is_empty());
        }
    }
}
