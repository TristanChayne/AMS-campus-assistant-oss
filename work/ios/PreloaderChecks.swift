import UIKit

// Exercise the real scheduling/retention code with controllable page completion.
final class CampusController: UIViewController {
    static var completes = true
    var isPreparingOffscreen = false
    var callback: ((String)->Void)?
    var reservationStateChanged: ((String)->Void)?
    var activations = 0
    init(url:URL) { super.init(nibName:nil,bundle:nil) }
    required init?(coder:NSCoder) { fatalError() }
    func prepareInBackground(_ completion:@escaping (String)->Void) { isPreparingOffscreen = true; callback = completion; if Self.completes { completion("ready") } }
    func activatePreparedPage() { isPreparingOffscreen = false; activations += 1 }
    func cancelPreparation() { callback = nil }
}

@main struct Checks {
    static func wait(_ seconds:Double) { RunLoop.main.run(until:Date().addingTimeInterval(seconds)) }
    static func main() {
        let pool = ReservationPreloader()
        pool.start(); wait(2.2)
        precondition(pool.states["seat"] == "ready" && pool.pages["room"] == nil)
        let first = pool.page(for:"seat")!
        precondition(pool.page(for:"seat") === first && first.activations == 2)
        pool.suspend(); wait(2.2); precondition(pool.pages["room"] == nil)
        pool.start(); wait(2.2); precondition(pool.states["room"] == "ready" && pool.pages.count == 2)
        wait(4.4); precondition(pool.states["records"] == "ready" && pool.states["roomRecords"] == "ready" && pool.pages.count == 4)
        pool.discardUnused(keeping:first); precondition(pool.pages.count == 1 && pool.pages["seat"] === first)
        CampusController.completes = false
        pool.start(); wait(2.2)
        let pending = pool.pages["room"]!
        let staleCallback = pending.callback!
        pool.suspend(); staleCallback("ready")
        precondition(pool.pages["room"] == nil && pool.states["room"] == nil)
        CampusController.completes = true
        let early = ReservationPreloader(); early.start()
        let demanded = early.page(for:"seat")!
        wait(2.2); precondition(early.pages["seat"] === demanded && early.pages.count == 1)
        early.suspend()
        print("PASS: sequential preloading, page reuse, background cancellation, memory release and late callback isolation")
    }
}
