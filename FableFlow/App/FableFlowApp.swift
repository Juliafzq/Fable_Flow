import SwiftUI

@main
struct FableFlowApp: App {
    var body: some Scene {
        WindowGroup {
            UntoFlowWebContainerView()
                .ignoresSafeArea()
                .preferredColorScheme(.light)
                // Tapping the Home Screen widget opens untoflow://timer
                .onOpenURL { url in
                    UntoFlowWebContainerView.handleDeepLink(url)
                }
        }
    }
}
