package com.nuclearplayer

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class NuclearMediaService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var playbackPausedByTransientLoss = false

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                playbackPausedByTransientLoss = false
                if (MainActivity.isMediaPlaying) {
                    MainActivity.dispatchActionToNuclear("toggle")
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (MainActivity.isMediaPlaying) {
                    playbackPausedByTransientLoss = true
                    MainActivity.dispatchActionToNuclear("toggle")
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                if (MainActivity.isMediaPlaying) {
                    playbackPausedByTransientLoss = true
                    MainActivity.dispatchActionToNuclear("toggle")
                }
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (playbackPausedByTransientLoss) {
                    playbackPausedByTransientLoss = false
                    if (!MainActivity.isMediaPlaying) {
                        MainActivity.dispatchActionToNuclear("toggle")
                    }
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        HyperIslandNotificationManager.init(this)

        val initialNotification = HyperIslandNotificationManager.buildInitialNotification(this)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    HyperIslandNotificationManager.NOTIFICATION_ID,
                    initialNotification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(HyperIslandNotificationManager.NOTIFICATION_ID, initialNotification)
            }
        } catch (_: Exception) {
        }

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nuclear::AudioWakeLock")
        wakeLock?.setReferenceCounted(false)
        wakeLock?.acquire(24 * 60 * 60 * 1000L)

        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        wifiLock = wifiManager?.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Nuclear::AudioWifiLock")
        wifiLock?.acquire()

        requestPlaybackAudioFocus()
    }

    private fun requestPlaybackAudioFocus() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(audioAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .build()
            audioFocusRequest = request
            audioManager?.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager?.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            )
        }
    }

    private fun abandonPlaybackAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(audioFocusChangeListener)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title") ?: "Nuclear Music"
        val artist = intent?.getStringExtra("artist") ?: "Streaming"
        val coverUrl = intent?.getStringExtra("coverUrl")
        val isPlaying = intent?.getBooleanExtra("isPlaying", true) ?: true
        val positionMs = intent?.getLongExtra("positionMs", 0L) ?: 0L
        val durationMs = intent?.getLongExtra("durationMs", 0L) ?: 0L

        MainActivity.isMediaActive = true
        MainActivity.isMediaPlaying = isPlaying

        HyperIslandNotificationManager.updateNotification(
            this,
            title,
            artist,
            coverUrl,
            isPlaying,
            positionMs,
            durationMs
        )

        if (isPlaying) {
            MainActivity.instance?.keepWebViewActive()
        }

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        MainActivity.isMediaActive = false
        MainActivity.isMediaPlaying = false
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        if (wifiLock?.isHeld == true) {
            wifiLock?.release()
        }
        abandonPlaybackAudioFocus()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {
        }
        HyperIslandNotificationManager.cancel(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
