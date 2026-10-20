import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Quenvira · Your business, running smoothly.',description:'Private service-business management workspace.',robots:{index:false,follow:false},icons:{icon:'/demo/icon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en-GB"><body>{children}</body></html>}
