import SwiftUI
import AVFoundation

@main
struct FableFlowApp: App {
    init() {
        // Let the app's in-page sounds (timer chime, ticks, pencil) play even when the iPhone's
        // Ring/Silent switch is on silent. `.mixWithOthers` keeps Apple Music / Spotify playing.
        // Without this, sounds from the built-in web view follow the silent switch and stay mute.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            UntoFlowWebContainerView()
                .ignoresSafeArea()
                .preferredColorScheme(.light)
                // Tapping a widget opens untoflow://timer or untoflow://card
                .onOpenURL { url in
                    UntoFlowWebContainerView.handleDeepLink(url)
                }
        }
    }
}
