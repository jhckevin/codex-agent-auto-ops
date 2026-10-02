#include <assert.h>
#include <stdio.h>
#include "motion.h"
int main(void){
 int values[]={-8192,-1025,-128,-127,-1,0,1,127,128,1025,8192};
 for(unsigned x=0;x<sizeof values/sizeof values[0];x++)for(unsigned y=0;y<sizeof values/sizeof values[0];y++){
  int dx=values[x],dy=values[y],n=cua_motion_steps(dx,dy),sx=0,sy=0;
  assert(n>=1&&n<=65);
  for(int i=1;i<=n;i++){int a=cua_motion_component(dx,i,n),b=cua_motion_component(dy,i,n);assert(abs(a)<=127&&abs(b)<=127);sx+=a;sy+=b;}
  assert(sx==dx&&sy==dy);
 }
 puts("motion packet bounds and signed roundtrip totals passed");
}
