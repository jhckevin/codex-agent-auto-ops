#pragma once
#include <stdlib.h>
static inline int cua_motion_steps(int dx,int dy){
 int n=abs(dx)>abs(dy)?abs(dx):abs(dy);return n?(n+126)/127:1;
}
static inline int cua_motion_component(int total,int index,int steps){
 return total*index/steps-total*(index-1)/steps;
}
