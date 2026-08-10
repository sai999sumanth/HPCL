import axios from "axios";
let count = 0;

// BUG-FIX: was hardcoded to "localhost:5173" — broken in production.
// baseURL="" means requests go to the same origin, so nginx proxies /api correctly.
const axiosHttp = axios.create({
  baseURL: "",
});

axiosHttp.interceptors.request.use(
  (config) => {
    // config.headers.set('Authorization','Bearer '+ (localStorage.getItem('X-At') || localStorage.getItem('X-Rt')))
    console.log(config, "Request Config")
    return config
  },
  (error) => {
    //return Promise.reject(error);
  }
);
//localStorage.setItem('X-At', config.headers.get('X-At'))
axiosHttp.interceptors.response.use(
  (response: any) => {
    // const urls = ['/api/user/login']
    // if(urls.indexOf(response.config.url)>-1)
    //     localStorage.setItem('user', JSON.stringify(response?.data?.results))
    // if(response.headers.get('X-At'))
    //     localStorage.setItem('X-At', response.headers.get('X-At'))
    // if(response.headers.get('X-Rt'))
    //     localStorage.setItem('X-Rt', response.headers.get('X-Rt'))
     console.log(response, "Service resoponse")
     return Promise.resolve(response)
  },
  (error) => {
    if (error?.response?.status === 401) {
    //   if(count<3){
    //     localStorage.setItem('X-At', '')
    //     count++;
    //     return axios.request(error.config);
    //   }
    //   localStorage.setItem('X-Rt', '');
    //   localStorage.setItem('user', '');
    //   if (typeof window !== "undefined") {
    //     //@ts-ignore
    //      window.location = "/login"
    //   }
      
    }
    console.log(error, "Service error")
    return Promise.reject(error);
  }
);

export default axiosHttp;