package cn.local.ams;
public class LicenseScheduleCheck {
 static void check(boolean value){if(!value)throw new AssertionError();}
 public static void main(String[] args){long start=1000000000L,day=86400000L;
 check(Activation.CHECK_INTERVAL_DAYS==2);
 check(!Activation.due(start+2*day-1,start,0,Activation.CHECK_INTERVAL_DAYS));check(Activation.due(start+2*day,start,0,Activation.CHECK_INTERVAL_DAYS));
 check(!Activation.due(start+2*day,start,start+2*day-1000,2));check(Activation.due(start+2*day,start,start+2*day-3600000,2));
 check(!Activation.due(start+7*day-1,start,0,7));check(Activation.due(start+7*day,start,0,7));
 check(!Activation.due(start+7*day,start,0,14));check(Activation.due(start+14*day,start,0,14));
 check(!Activation.due(start+7*day,start,start+7*day-1000,7));check(Activation.due(start+7*day,start,start+7*day-3600000,7));
 check(Activation.due(start,0,0,7));check(Activation.due(start-1,start,0,7));
 System.out.println("PASS 2-day client cadence, interval boundaries, hourly failure backoff, first check and clock rollback.");}
}