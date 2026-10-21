import UIKit

// Sequentially retained controllers reuse their WKWebViews, not just downloaded resources.
final class ReservationPreloader {
    private(set) var pages: [String:CampusController] = [:]
    private(set) var states: [String:String] = [:]
    var onChange: (([String:String]) -> Void)?
    private var scheduled: DispatchWorkItem?
    private var warming: String?
    private var suspended = true
    private var waitingForLogin = false
    private let destinations = [("seat","https://seatbookings.xjtlu.edu.cn/"),("room","https://roombookings.xjtlu.edu.cn/"),("records","https://seatbookings.xjtlu.edu.cn/#/ic/userinfo"),("roomRecords","https://roombookings.xjtlu.edu.cn/#/ic/userinfo")]

    func start() { suspended = false; next() }
    private func next() {
        guard !suspended, !waitingForLogin, warming == nil, scheduled == nil, let target = destinations.first(where:{ pages[$0.0] == nil && states[$0.0] == nil }) else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }; self.scheduled = nil
            guard !self.suspended else { return }
            guard self.pages[target.0] == nil else { self.next(); return }
            let page = CampusController(url:URL(string:target.1)!)
            self.pages[target.0] = page; self.warming = target.0
            self.states[target.0] = "preparing"; self.onChange?(self.states)
            page.reservationStateChanged = { [weak self, weak page] state in
                guard let self, let page, self.pages[target.0] === page else { return }
                self.changed(state,for:target.0)
            }
            page.prepareInBackground { [weak self, weak page] result in
                guard let self, let page, self.pages[target.0] === page else { return }
                self.states[target.0] = result; self.warming = nil
                if result == "login" { self.waitingForLogin = true }
                self.onChange?(self.states); self.next()
            }
        }
        scheduled = work; DispatchQueue.main.asyncAfter(deadline:.now()+2,execute:work)
    }
    func page(for key:String) -> CampusController? {
        if pages[key] == nil, let target = destinations.first(where:{ $0.0 == key }) {
            let page = CampusController(url:URL(string:target.1)!)
            pages[key] = page; states[key] = "preparing"; onChange?(states)
            page.reservationStateChanged = { [weak self, weak page] state in
                guard let self, let page, self.pages[key] === page else { return }
                self.changed(state,for:key)
            }
            page.prepareInBackground { [weak self, weak page] state in
                guard let self, let page, self.pages[key] === page else { return }
                self.states[key] = state; if state == "login" { self.waitingForLogin = true }; self.onChange?(self.states); self.next()
            }
        }
        guard let page = pages[key] else { return nil }
        page.activatePreparedPage(); return page
    }
    func suspend() {
        suspended = true; scheduled?.cancel(); scheduled = nil
        if let key = warming, let page = pages[key], page.isPreparingOffscreen {
            page.cancelPreparation(); pages.removeValue(forKey:key); states.removeValue(forKey:key)
            warming = nil; onChange?(states)
        }
    }
    private func changed(_ state:String,for key:String) {
        let previous = states[key]
        states[key] = state
        if state == "ready",previous == "login" {
            waitingForLogin = false
            for (other,page) in Array(pages) where other != key && states[other] == "login" {
                page.cancelPreparation(); pages.removeValue(forKey:other); states.removeValue(forKey:other)
            }
            next()
        }
        onChange?(states)
    }
    func discardUnused(keeping visible:UIViewController?) {
        suspend()
        waitingForLogin = false
        for (key,page) in Array(pages) where page !== visible { page.cancelPreparation(); pages.removeValue(forKey:key); states.removeValue(forKey:key) }
        if let key = warming, pages[key] == nil { warming = nil }
        onChange?(states)
    }
}
