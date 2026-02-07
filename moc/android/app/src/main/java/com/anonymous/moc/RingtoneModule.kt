package com.anonymous.moc

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RingtoneModule.NAME)
class RingtoneModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val NAME = "RingtonePicker"
        const val REQUEST_CODE = 12345
    }

    private var promise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = NAME

    @ReactMethod
   fun openRingtonePicker(type: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
        promise.reject("NO_ACTIVITY", "Current activity is null")
        return
    }

    this.promise = promise

    val ringtoneType = when (type) {
        "ringtone" -> RingtoneManager.TYPE_RINGTONE
        else -> RingtoneManager.TYPE_NOTIFICATION
    }

    val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
        putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, ringtoneType)
        putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Select Tone")
        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
    }

    activity.startActivityForResult(intent, REQUEST_CODE)
}


    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, intent: Intent?) {
        if (requestCode == REQUEST_CODE) {
            val uri: Uri? = intent?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
            if (uri != null) {
                val ringtone = RingtoneManager.getRingtone(reactApplicationContext, uri)
                val title = ringtone.getTitle(reactApplicationContext)

                val result = Arguments.createMap().apply {
                    putString("uri", uri.toString())
                    putString("title", title)
                }
                promise?.resolve(result)
            } else {
                promise?.reject("NO_SELECTION", "No ringtone was selected")
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // No-op
    }
}
