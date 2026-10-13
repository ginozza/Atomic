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

    const val CHANNEL_ID = "nuclear_playback_channel_v2"
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
                                PlaybackStateCompat.ACTION_SEEK_TO or
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

                    override fun onSeekTo(pos: Long) {
                        MainActivity.dispatchSeekToNuclear(pos)
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
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            try {
                notificationManager.deleteNotificationChannel("nuclear_playback_channel")
            } catch (_: Exception) {}

            val name = "Nuclear Playback"
            val descriptionText = "Nuclear Music Player notification and HyperIsland controls"
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun isHyperOS(): Boolean {
        return Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true) ||
            Build.BRAND.equals("Xiaomi", ignoreCase = true) ||
            Build.BRAND.equals("Redmi", ignoreCase = true) ||
            Build.BRAND.equals("POCO", ignoreCase = true)
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
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
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

        val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_music_note)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(appPendingIntent)
            .setOngoing(isPlaying)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

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

            val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
            val speed = if (isPlaying) 1.0f else 0.0f
            val playbackState = PlaybackStateCompat.Builder()
                .setState(
                    state,
                    positionMs,
                    speed,
                    android.os.SystemClock.elapsedRealtime()
                )
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SEEK_TO or
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
