import UIKit

struct CampusPalette {
    static let colors: [String:[UInt32]] = ["blue":[0x172E61,0x254E9B,0xEAF0FA],"green":[0x205C52,0x327E70,0xE8F3EF],"dusk":[0x405D7A,0x405D7A,0xEAF0F6],"teal":[0x356B68,0x356B68,0xE9F2F0],"sage":[0x526B58,0x526B58,0xEDF2ED],"smoke":[0x655F7C,0x655F7C,0xF0EDF5],"graphite":[0x555E6A,0x555E6A,0xEDF0F3],"rose":[0x956174,0x805064,0xF5EBEF],"wheat":[0x806A28,0x756020,0xF5F0DF]]
    let key: String
    let dark: Bool
    var primary: UIColor { color(Self.colors[key]?[0] ?? 0x172E61) }
    var paper: UIColor { color(dark ? 0x15191F : 0xF5F6F8) }
    var surface: UIColor { color(dark ? 0x202630 : 0xFCFDFE) }
    var ink: UIColor { color(dark ? 0xE7ECF4 : 0x17233A) }
    private func color(_ hex:UInt32) -> UIColor { UIColor(red:CGFloat((hex >> 16)&255)/255,green:CGFloat((hex >> 8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1) }
    var script: String {
        let values = Self.colors[key] ?? Self.colors["blue"]!
        func hex(_ number:UInt32) -> String { String(format:"#%06x",number) }
        func mix(_ a:UInt32,_ b:UInt32,_ amount:Double) -> UInt32 { [16,8,0].reduce(UInt32(0)) { out,shift in out | (UInt32((Double((a >> shift)&255)*(1-amount)+Double((b >> shift)&255)*amount).rounded()) << shift) } }
        let surface:UInt32 = dark ? 0x202630 : 0xFCFDFE
        let colors:[String:UInt32] = ["paper":dark ? 0x15191F : 0xF5F6F8,"surface":surface,"input":dark ? 0x191F27 : 0xF5F7FA,"ink":dark ? 0xE7ECF4 : 0x17233A,"muted":dark ? 0xA4AFBF : 0x69758A,"line":dark ? 0x343D49 : 0xE2E8F0,"primary":values[0],"accent":dark ? mix(values[1],0xFFFFFF,0.55) : values[1],"wash":dark ? mix(surface,values[0],0.30) : values[2]]
        return "document.documentElement.classList.toggle('campus-dark',\(dark));" + colors.map { "document.documentElement.style.setProperty('--campus-\($0.key)','\(hex($0.value))');" }.joined()
    }
}
