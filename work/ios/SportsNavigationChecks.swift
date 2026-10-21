import Foundation

@main enum SportsNavigationChecks {
    static func main() {
        func url(_ value:String) -> URL { URL(string:value)! }
        let root = "https://sportscentre.xipueduinno.cn"
        for path in ["/website","/website/","/website/court","/website/order#/","/website/member#/ticket","/website/pay?order=synthetic"] { precondition(SportsNavigation.official(url(root+path)),path) }
        for value in [root+"/api/order",root+"/website/../api",root+"/website/%2e%2e/api",root+"/website/%2fapi",root+"/website/%252e%252e/api",root+"/website/a%5cb",root+"/website//pay","http://sportscentre.xipueduinno.cn/website/court","https://sportscentre.xipueduinno.cn.evil.test/website/court","https://user@sportscentre.xipueduinno.cn/website/court","https://sportscentre.xipueduinno.cn:8443/website/court"] { precondition(!SportsNavigation.official(url(value)),value) }
        for value in ["https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb","https://payapp.weixin.qq.com/pay","https://mclient.alipay.com/pay","https://alipay.com/pay"] { precondition(SportsNavigation.payment(url(value)),value) }
        for value in ["http://wx.tenpay.com/pay","https://wx.tenpay.com.evil.test/pay","https://evilalipay.com/pay","https://user@alipay.com/pay","https://alipay.com:8443/pay"] { precondition(!SportsNavigation.payment(url(value)),value) }
        for value in ["weixin://wap/pay?synthetic=1","alipays://platformapi/startapp?synthetic=1","alipay://platformapi/startapp?synthetic=1"] { precondition(SportsNavigation.paymentApp(url(value)),value) }
        for value in ["weixin://scan/pay","weixin://wap/pay/other","weixin://wap/%70ay","alipays://platformapi/startapp#other","intent://wap/pay","alipay://platformapi/other","weixin://user@wap/pay"] { precondition(!SportsNavigation.paymentApp(url(value)),value) }
        precondition(SportsNavigation.safeRetry(url(root+"/website/pay?order=synthetic")) == SportsNavigation.sections[0])
        precondition(SportsNavigation.safeRetry(url(root+"/website/order?order=synthetic")) == SportsNavigation.sections[0])
        precondition(SportsNavigation.safeRetry(url(root+"/website/member#/ticket")) == SportsNavigation.sections[2])
        precondition(SportsNavigation.paying(url(root+"/website/pay")))
        print("PASS: sports official/payment/app URL boundaries, traversal, lookalikes and parameter-free retry")
    }
}
