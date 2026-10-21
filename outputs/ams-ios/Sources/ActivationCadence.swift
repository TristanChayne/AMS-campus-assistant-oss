import Foundation

enum ActivationCadence {
    // Legacy protocol only (server without the per-open check): two days, one-hour network retry spacing.
    static func due(now:TimeInterval,last:TimeInterval,attempt:TimeInterval) -> Bool {
        if last > 0, now >= last, now - last < 2 * 86400 { return false }
        return !(attempt > 0 && now >= attempt && now - attempt < 3600)
    }
}
