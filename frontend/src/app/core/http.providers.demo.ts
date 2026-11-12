import { HttpInterceptorFn } from '@angular/common/http';
import { demoInterceptor } from './demo/demo.interceptor';

export const httpInterceptors: HttpInterceptorFn[] = [demoInterceptor];
