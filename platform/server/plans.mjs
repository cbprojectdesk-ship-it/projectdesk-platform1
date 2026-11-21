// Staged catalogue: no runtime change until all server settings are supplied.
export function planCatalog(env) {
 if(!env.QUENVIRA_PLAN_CATALOG)return null;
 const version=env.QUENVIRA_PLAN_CATALOG;
 if(!['solo-team-v1','solo-team-v2'].includes(version))throw Error('Unknown plan catalogue');
 if(env.QUENVIRA_TEAM_STAFF_LIMIT!==undefined&&env.QUENVIRA_TEAM_STAFF_LIMIT!=='5')throw Error('Team 5 includes five people; select a larger approved band instead');
 const rows=[['solo','Solo',799,1,'STRIPE_SOLO_PRICE_ID'],['team','Team 5',1499,5,'STRIPE_TEAM_PRICE_ID']];
 if(version==='solo-team-v2')rows.push(['team10','Team 10',2499,10,'STRIPE_TEAM10_PRICE_ID'],['team15','Team 15',3299,15,'STRIPE_TEAM15_PRICE_ID'],['team20','Team 20',3999,20,'STRIPE_TEAM20_PRICE_ID']);
 const plans=rows.map(([id,name,amount,maxPeople,key])=>({id,name,amount,price:env[key],maxPeople,maxStaff:maxPeople,maxStaffAccounts:maxPeople-1,staffAccess:maxPeople>1}));
 if(plans.some(p=>!/^price_\w+$/.test(p.price||''))||new Set(plans.map(p=>p.price)).size!==plans.length)throw Error('Distinct plan prices required');
 return plans;
}
export function publicPlans(config){return config?.plans?.map(({price,...plan})=>plan)}
export function planForSubscription(subscription,config){
 const items=subscription?.items?.data;
 if(subscription?.livemode!==(config.mode==='live')||!Array.isArray(items)||items.length!==1||items[0].quantity!==1)return null;
 const price=typeof items[0].price==='string'?items[0].price:items[0].price?.id;
 return config.plans?.find(p=>p.price===price)||null;
}
export function selectPlan(config,id){return config.plans?.find(p=>p.id===id)||null}
export function fitsPlan(state,staffMemberships,plan){return state.staff.filter(s=>s.active!==false).length<=plan.maxStaff&&staffMemberships<=(plan.maxStaffAccounts??(plan.staffAccess?plan.maxStaff-1:0))}

export const LARGE_TEAM_MESSAGE='Your current people allowance has been reached. Choose an approved larger Team band; above twenty people, contact ccscreativetech@gmail.com for a tailored quote. No extra charge has been made.';
