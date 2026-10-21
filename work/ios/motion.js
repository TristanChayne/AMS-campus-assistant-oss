function iosRouteDepth(route) {
  if (['/home','/course','/leave','/reservations'].includes(route)) return 0;
  if (['/settings','/signCode','/leaveApplication','/course/sessions'].includes(route)) return 1;
  if (['/campusMaps','/leaveCourse'].includes(route)) return 2;
  return 1;
}
window.__amsIosAnimateRoute = (panel, from, to) => {
  panel.__amsIosAnimation?.cancel();
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const roots = iosRouteDepth(from) === 0 && iosRouteDepth(to) === 0;
  const backwards = iosRouteDepth(to) < iosRouteDepth(from);
  const start = roots ? 'none' : `translateX(${backwards ? -16 : 16}px)`;
  const animation = panel.animate([{opacity:0.65,transform:start},{opacity:1,transform:'none'}],{duration:roots?120:220,easing:'cubic-bezier(.2,.7,.2,1)'});
  panel.__amsIosAnimation = animation;
  animation.onfinish = () => { if (panel.__amsIosAnimation === animation) panel.__amsIosAnimation = null; };
};
