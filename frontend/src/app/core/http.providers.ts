import { HttpInterceptorFn } from '@angular/common/http';
import { authInterceptor } from './interceptor';

export const httpInterceptors: HttpInterceptorFn[] = [authInterceptor];
