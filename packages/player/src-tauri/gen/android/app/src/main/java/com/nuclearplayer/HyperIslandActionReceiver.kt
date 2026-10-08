package com.nuclearplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class HyperIslandActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            HyperIslandNotificationManager.ACTION_TOGGLE -> {
                MainActivity.dispatchActionToNuclear("toggle")
            }
            HyperIslandNotificationManager.ACTION_NEXT -> {
                MainActivity.dispatchActionToNuclear("next")
            }
            HyperIslandNotificationManager.ACTION_PREVIOUS -> {
                MainActivity.dispatchActionToNuclear("previous")
            }
            HyperIslandNotificationManager.ACTION_STOP -> {
                MainActivity.dispatchActionToNuclear("stop")
            }
        }
    }
}
