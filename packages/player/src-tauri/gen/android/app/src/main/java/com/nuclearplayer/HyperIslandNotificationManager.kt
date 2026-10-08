package com.nuclearplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

object HyperIslandNotificationManager {

    const val CHANNEL_ID = "nuclear_playback_channel"
    const val NOTIFICATION_ID = 2026

    const val ACTION_TOGGLE = "com.nuclearplayer.ACTION_TOGGLE"
    const val ACTION_NEXT = "com.nuclearplayer.ACTION_NEXT"
    const val ACTION_PREVIOUS = "com.nuclearplayer.ACTION_PREVIOUS"
    const val ACTION_STOP = "com.nuclearplayer.ACTION_STOP"

    private var currentCoverBitmap: Bitmap? = null
    private var lastCoverUrl: String? = null
    private var mediaSession: MediaSessionCompat? = null
    private var lastNotifiedTitle: String? = null
    private var lastNotifiedArtist: String? = null
    private var isForegroundServiceStarted = false

    fun init(context: Context) {
        createNotificationChannel(context)
        if (mediaSession == null) {
            mediaSession = MediaSessionCompat(context, "NuclearMediaSession").apply {
                isActive = true
                setPlaybackState(
                    PlaybackStateCompat.Builder()
                        .setActions(
                            PlaybackStateCompat.ACTION_PLAY or
                                PlaybackStateCompat.ACTION_PAUSE or
                                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                                PlaybackStateCompat.ACTION_STOP
                        )
                        .build()
                )
                setCallback(object : MediaSessionCompat.Callback() {
                    override fun onPlay() {
                        if (!MainActivity.isMediaPlaying) {
                            MainActivity.dispatchActionToNuclear("toggle")
                        }
                    }

                    override fun onPause() {
                        if (MainActivity.isMediaPlaying) {
                            MainActivity.dispatchActionToNuclear("toggle")
                        }
                    }

                    override fun onSkipToNext() {
                        MainActivity.dispatchActionToNuclear("next")
                    }

                    override fun onSkipToPrevious() {
                        MainActivity.dispatchActionToNuclear("previous")
                    }

                    override fun onStop() {
                        MainActivity.dispatchActionToNuclear("stop")
                    }

                    override fun onMediaButtonEvent(mediaButtonEvent: Intent?): Boolean {
                        val keyEvent = mediaButtonEvent?.getParcelableExtra<android.view.KeyEvent>(Intent.EXTRA_KEY_EVENT)
                        if (keyEvent?.action == android.view.KeyEvent.ACTION_DOWN) {
                            when (keyEvent.keyCode) {
                                android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                                android.view.KeyEvent.KEYCODE_HEADSETHOOK -> {
                                    MainActivity.dispatchActionToNuclear("toggle")
                                    return true
                                }
                            }
                        }
                        return super.onMediaButtonEvent(mediaButtonEvent)
                    }
                })
            }
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Nuclear Playback"
            val descriptionText = "Nuclear Music Player notification and HyperIsland controls"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
                setSound(null, null)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun isHyperOS(): Boolean {
        return Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true)
    }

    fun isHyperIslandSupported(context: Context): Boolean {
        if (!isHyperOS()) return false
        return try {
            val method = Class.forName("android.os.SystemProperties").getDeclaredMethod("getBoolean", String::class.java, Boolean::class.java)
            (method.invoke(null, "persist.sys.feature.island", false) as? Boolean) ?: true
        } catch (e: Exception) {
            true
        }
    }

    fun updateNotification(
        context: Context,
        title: String,
        artist: String,
        coverUrl: String?,
        isPlaying: Boolean,
        positionMs: Long,
        durationMs: Long
    ) {
        init(context)

        val isNewTrack = (title != lastNotifiedTitle || artist != lastNotifiedArtist)
        lastNotifiedTitle = title
        lastNotifiedArtist = artist

        // Asynchronously load cover if URL changed
        if (coverUrl != null && coverUrl.isNotBlank() && coverUrl != lastCoverUrl) {
            lastCoverUrl = coverUrl
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val loader = ImageLoader(context)
                    val request = ImageRequest.Builder(context)
                        .data(coverUrl)
                        .allowHardware(false)
                        .build()
                    val result = (loader.execute(request) as? SuccessResult)?.drawable
                    val bitmap = (result as? BitmapDrawable)?.bitmap
                    if (bitmap != null) {
                        currentCoverBitmap = getRoundedBitmap(bitmap, 24f)
                    }
                } catch (_: Exception) {
                }
                CoroutineScope(Dispatchers.Main).launch {
                    postNotification(context, title, artist, coverUrl, isPlaying, positionMs, durationMs, isNewTrack)
                }
            }
            return
        }

        postNotification(context, title, artist, coverUrl, isPlaying, positionMs, durationMs, isNewTrack)
    }

    fun buildInitialNotification(context: Context): Notification {
        init(context)
        isForegroundServiceStarted = true
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context,
            0,
            appIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_music_note)
            .setContentTitle("Atomic Music")
            .setContentText("Playing")
            .setContentIntent(appPendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun postNotification(
        context: Context,
        title: String,
        artist: String,
        coverUrl: String?,
        isPlaying: Boolean,
        positionMs: Long,
        durationMs: Long,
        isNewTrack: Boolean = false
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Intent to launch app on click
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            context,
            0,
            appIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Pending Intents for Playback Buttons
        val toggleIntent = PendingIntent.getBroadcast(
            context,
            1,
            Intent(ACTION_TOGGLE).setPackage(context.packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val nextIntent = PendingIntent.getBroadcast(
            context,
            2,
            Intent(ACTION_NEXT).setPackage(context.packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val prevIntent = PendingIntent.getBroadcast(
            context,
            3,
            Intent(ACTION_PREVIOUS).setPackage(context.packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val playPauseIconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play

        // 1. Inflate RemoteViews for Xiaomi HyperOS 3 HyperIsland (Tiny Pill)
        val rvTiny = RemoteViews(context.packageName, R.layout.layout_island_tiny).apply {
            setTextViewText(R.id.tv_tiny_title, "$title • $artist")
            if (currentCoverBitmap != null) {
                setImageViewBitmap(R.id.iv_tiny_cover, currentCoverBitmap)
            } else {
                setImageViewBitmap(R.id.iv_tiny_cover, null)
            }
        }

        // 2. Inflate RemoteViews for Xiaomi HyperOS 3 HyperIsland (Expanded Island)
        val progressPercent = if (durationMs > 0) ((positionMs * 100) / durationMs).toInt() else 0
        val rvIslandExpand = RemoteViews(context.packageName, R.layout.layout_island_expanded).apply {
            setTextViewText(R.id.tv_expanded_title, title)
            setTextViewText(R.id.tv_expanded_artist, artist)
            setImageViewResource(R.id.btn_expanded_play_pause, playPauseIconRes)
            setProgressBar(R.id.pb_expanded_progress, 100, progressPercent, false)

            if (currentCoverBitmap != null) {
                setImageViewBitmap(R.id.iv_expanded_cover, currentCoverBitmap)
            } else {
                setImageViewBitmap(R.id.iv_expanded_cover, null)
            }

            setOnClickPendingIntent(R.id.btn_expanded_play_pause, toggleIntent)
            setOnClickPendingIntent(R.id.btn_expanded_next, nextIntent)
            setOnClickPendingIntent(R.id.btn_expanded_prev, prevIntent)
            setOnClickPendingIntent(R.id.island_expanded_root, appPendingIntent)
        }

        // 3. Inflate RemoteViews for Xiaomi Focus Banner (Notification Shade & Lockscreen)
        val rvFocus = RemoteViews(context.packageName, R.layout.layout_focus_music).apply {
            setTextViewText(R.id.tv_focus_title, title)
            setTextViewText(R.id.tv_focus_artist, artist)
            setImageViewResource(R.id.btn_focus_play_pause, playPauseIconRes)

            if (currentCoverBitmap != null) {
                setImageViewBitmap(R.id.iv_focus_cover, currentCoverBitmap)
            } else {
                setImageViewBitmap(R.id.iv_focus_cover, null)
            }

            setOnClickPendingIntent(R.id.btn_focus_play_pause, toggleIntent)
            setOnClickPendingIntent(R.id.btn_focus_next, nextIntent)
            setOnClickPendingIntent(R.id.btn_focus_prev, prevIntent)
            setOnClickPendingIntent(R.id.focus_music_root, appPendingIntent)
        }

        // 4. Construct Notification with Xiaomi Focus & Standard MediaStyle fallback
        val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_music_note)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(appPendingIntent)
            .setOngoing(isPlaying)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        mediaSession?.let { session ->
            session.isActive = true
            val metadataBuilder = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)

            if (!coverUrl.isNullOrBlank()) {
                metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, coverUrl)
                metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ART_URI, coverUrl)
                metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, coverUrl)
            }

            currentCoverBitmap?.let { bmp ->
                metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bmp)
                metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bmp)
                metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, bmp)
            }
            session.setMetadata(metadataBuilder.build())

            val playbackState = PlaybackStateCompat.Builder()
                .setState(
                    if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                    positionMs,
                    1.0f
                )
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_STOP
                )
                .build()
            session.setPlaybackState(playbackState)

            val mediaStyle = androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.sessionToken)
                .setShowActionsInCompactView(0, 1, 2)
            notificationBuilder.setStyle(mediaStyle)
        }

        notificationBuilder.addAction(R.drawable.ic_skip_previous, "Previous", prevIntent)
        notificationBuilder.addAction(playPauseIconRes, if (isPlaying) "Pause" else "Play", toggleIntent)
        notificationBuilder.addAction(R.drawable.ic_skip_next, "Next", nextIntent)

        currentCoverBitmap?.let {
            notificationBuilder.setLargeIcon(it)
        }

        val extras = Bundle()
        val picsBundle = Bundle()

        val tickerIcon = currentCoverBitmap?.let { Icon.createWithBitmap(it) }
            ?: Icon.createWithResource(context, R.drawable.ic_music_note)

        picsBundle.putParcelable("miui.focus.pic_ticker", tickerIcon)
        picsBundle.putParcelable("miui.focus.pic_cover", tickerIcon)
        picsBundle.putParcelable("miui.focus.pic_small", tickerIcon)
        picsBundle.putParcelable("miui.focus.pic_left", tickerIcon)
        picsBundle.putParcelable("miui.focus.pic_icon", tickerIcon)
        picsBundle.putParcelable("miui.focus.pic_imageText", tickerIcon)

        val smallIslandArea = JSONObject().apply {
            val picInfo = JSONObject().apply {
                put("type", 1)
                put("pic", "miui.focus.pic_cover")
            }
            val imageTextInfoLeft = JSONObject().apply {
                put("type", 1)
                put("picInfo", picInfo)
            }
            put("picInfo", picInfo)
            put("imageTextInfoLeft", imageTextInfoLeft)
            put("type", 1)
            put("pic", "miui.focus.pic_cover")
        }

        val bigIslandArea = JSONObject().apply {
            val picInfo = JSONObject().apply {
                put("type", 1)
                put("pic", "miui.focus.pic_cover")
            }
            val imageTextInfoLeft = JSONObject().apply {
                put("type", 1)
                put("picInfo", picInfo)
            }
            put("picInfo", picInfo)
            put("imageTextInfoLeft", imageTextInfoLeft)
            put("showBadge", false)
            put("showIcon", false)
            put("type", 1)
            put("pic", "miui.focus.pic_cover")
        }

        val paramIsland = JSONObject().apply {
            put("islandPriority", 3)
            put("dismissIsland", false)
            put("maxSize", false)
            put("needCloseAnimation", true)
            put("highlightColor", "#00FFA3")
            put("leftPic", "miui.focus.pic_cover")
            put("smallPic", "miui.focus.pic_cover")
            put("pic", "miui.focus.pic_cover")
            put("bigPic", "miui.focus.pic_cover")
            put("coverPic", "miui.focus.pic_cover")
            put("icon", "miui.focus.pic_cover")
            put("iconPic", "miui.focus.pic_cover")
            put("smallIcon", "miui.focus.pic_cover")
            put("showBadge", false)
            put("showIcon", false)
            put("showSmallIcon", false)
            put("smallIslandArea", smallIslandArea)
            put("smallIslandAreaLeft", smallIslandArea)
            put("leftIslandArea", smallIslandArea)
            put("bigIslandArea", bigIslandArea)
        }

        val paramCustom = JSONObject().apply {
            put("ticker", "$title - $artist")
            put("tickerPic", "miui.focus.pic_cover")
            put("coverPic", "miui.focus.pic_cover")
            put("iconPic", "miui.focus.pic_cover")
            put("leftPic", "miui.focus.pic_cover")
            put("smallPic", "miui.focus.pic_cover")
            put("icon", "miui.focus.pic_cover")
            put("smallIslandArea", smallIslandArea)
            put("smallIslandAreaLeft", smallIslandArea)
            put("leftIslandArea", smallIslandArea)
            put("bigIslandArea", bigIslandArea)
            put("enableFloat", true)
            put("updatable", true)
            put("isShowNotification", true)
            put("islandFirstFloat", false)
            put("paramIsland", paramIsland)
        }

        val paramV2 = JSONObject().apply {
            put("business", "media")
            put("updatable", true)
            put("param_island", paramIsland)
        }

        val focusParamRoot = JSONObject().apply {
            put("param_v2", paramV2)
            put("param_island", paramIsland)
            put("business", "media")
            put("updatable", true)
        }

        val picsJson = JSONObject().apply {
            if (!coverUrl.isNullOrBlank() && coverUrl.startsWith("http")) {
                put("miui.focus.pic_cover", coverUrl)
                put("miui.focus.pic_imageText", coverUrl)
                put("miui.focus.pic_small", coverUrl)
                put("miui.focus.pic_left", coverUrl)
                put("miui.focus.pic_ticker", coverUrl)
                put("miui.focus.pic_icon", coverUrl)
            }
        }

        extras.putString("miui.focus.param", focusParamRoot.toString())
        extras.putString("miui.focus.param.custom", paramCustom.toString())
        extras.putString("miui.focus.pics", picsJson.toString())
        extras.putString("miui.focus.ticker", "$title - $artist")

        if (!coverUrl.isNullOrBlank() && coverUrl.startsWith("http")) {
            extras.putString("miui.focus.pic_imageText", coverUrl)
            extras.putString("miui.focus.pic_cover", coverUrl)
            extras.putString("miui.focus.pic_small", coverUrl)
            extras.putString("miui.focus.pic_left", coverUrl)
            extras.putString("miui.focus.pic_ticker", coverUrl)
            extras.putString("miui.focus.pic_icon", coverUrl)
        }

        extras.putParcelable("miui.focus.pic_ticker", tickerIcon)
        extras.putParcelable("miui.focus.pic_cover", tickerIcon)
        extras.putParcelable("miui.focus.pic_small", tickerIcon)
        extras.putParcelable("miui.focus.pic_left", tickerIcon)
        extras.putParcelable("miui.focus.pic_icon", tickerIcon)
        extras.putParcelable("miui.focus.pic_imageText", tickerIcon)
        extras.putParcelable("miui.focus.pics_bundle", picsBundle)

        extras.putParcelable("miui.focus.rv.tiny", rvTiny)
        extras.putParcelable("miui.focus.rv.island.expand", rvIslandExpand)
        extras.putParcelable("miui.focus.rv", rvFocus)

        notificationBuilder.addExtras(extras)

        val notification = notificationBuilder.build()

        if (context is android.app.Service) {
            if (!isForegroundServiceStarted) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        context.startForeground(
                            NOTIFICATION_ID,
                            notification,
                            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                        )
                    } else {
                        context.startForeground(NOTIFICATION_ID, notification)
                    }
                    isForegroundServiceStarted = true
                } catch (_: Exception) {
                    notificationManager.notify(NOTIFICATION_ID, notification)
                }
            } else {
                notificationManager.notify(NOTIFICATION_ID, notification)
            }
        } else {
            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }

    fun cancel(context: Context) {
        isForegroundServiceStarted = false
        lastNotifiedTitle = null
        lastNotifiedArtist = null
        lastCoverUrl = null
        currentCoverBitmap = null
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID)
    }

    private fun getRoundedBitmap(bitmap: Bitmap, cornerRadiusPx: Float): Bitmap {
        val size = Math.min(bitmap.width, bitmap.height)
        val x = (bitmap.width - size) / 2
        val y = (bitmap.height - size) / 2
        val squaredBitmap = Bitmap.createBitmap(bitmap, x, y, size, size)

        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint().apply {
            isAntiAlias = true
            shader = BitmapShader(squaredBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        }
        val rect = RectF(0f, 0f, size.toFloat(), size.toFloat())
        canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, paint)
        return output
    }
}
