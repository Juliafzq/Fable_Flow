import SwiftUI

@main
struct FableFlowApp: App {
    var body: some Scene {
        WindowGroup {
            UntoFlowWebContainerView()
                .ignoresSafeArea()
                .preferredColorScheme(.light)
        }
    }
}
