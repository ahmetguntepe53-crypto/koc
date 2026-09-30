import UIKit
import Capacitor

// iOS 27 SDK'sıyla derlenen uygulamalar UIScene yaşam döngüsünü benimsemezse açılışta çöker
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Pencereyi Info.plist'teki
// UISceneStoryboardFile (Main → CAPBridgeViewController) kurar; burada yalnızca URL/evrensel
// bağlantılar Capacitor'a iletilir — sahne varken iOS bunları AppDelegate'e göndermez.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
