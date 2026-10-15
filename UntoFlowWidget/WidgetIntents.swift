import AppIntents
import WidgetKit

// Buttons inside the widget. These run inside the widget itself (no need to open the app);
// the widget redraws automatically after each one.

struct AdjustTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Change tomato length"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Minutes")
    var deltaMinutes: Int

    init() {}

    init(deltaMinutes: Int) {
        self.deltaMinutes = deltaMinutes
    }

    func perform() async throws -> some IntentResult {
        WidgetTimerStore.adjust(byMinutes: deltaMinutes)
        return .result()
    }
}

struct StartPauseTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Start or pause tomato"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        WidgetTimerStore.startOrPause()
        return .result()
    }
}

struct StopTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Reset tomato"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        WidgetTimerStore.stop()
        return .result()
    }
}

struct ToggleCardTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Cross out task"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Task ID")
    var taskID: String

    init() {}

    init(taskID: String) {
        self.taskID = taskID
    }

    func perform() async throws -> some IntentResult {
        WidgetSharedStore.toggleFromWidget(taskID: taskID)
        return .result()
    }
}
