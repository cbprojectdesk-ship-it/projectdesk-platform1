import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getChatGPTUser();
 return <main className="landing"><p className="eyebrow">QUENVIRA · YOUR BUSINESS, RUNNING SMOOTHLY.</p><h1>A clearer day.<br/>A better-run business.</h1><p>Customers, recurring schedules, staff, checklists and invoices in one place.</p>{user?<><a className="button" href="/workspace.html">Open your secure workspace →</a><p>Signed in as {user.email}. <a href={chatGPTSignOutPath('/')} target="_top">Sign out</a></p></>:<a className="button" href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT →</a>}<a href="/demo/index.html">Explore the separate fictional demonstration →</a><a href="/legal.html">Legal &amp; privacy →</a><aside><strong>Private development release</strong><p>Server storage and access controls are under verification. Use fictional data while acceptance testing and operational safeguards are completed. No paid subscriptions are offered.</p></aside></main>
}
