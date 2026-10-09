// Whether MobileTabBar is currently tucked away by its hide-on-scroll.
// MobileTabBar is the only writer; pages with their own bottom-anchored
// chrome (the /new Start footer) read it to slide down in step with the bar
// instead of leaving a bar-sized gap where it used to be.
export const useTabBarHidden = () => useState('tab-bar-hidden', () => false);
