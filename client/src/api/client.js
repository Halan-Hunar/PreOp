import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('preop_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      localStorage.removeItem('preop_token')
      localStorage.removeItem('preop_user')
      if (path !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
