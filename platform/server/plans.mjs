// Staged catalogue: no runtime change until all server settings are supplied.
export function planCatalog(env) {
 if(!env.QUENVIRA_PLAN_CATALOG)return null;
 if(env.QUENVIRA_PLAN_CATALOG!=='solo-team-v1')throw Error('Unknown plan catalogue');
 const cap=Number(env.QUENVIRA_TEAM_STAFF_LIMIT);
 if(!Number.isSafeInteger(cap)||cap<2||cap>50)throw Error('Team allowance requires operator configuration');
 const solo=env.STRIPE_SOLO_PRICE_ID,team=env.STRIPE_TEAM_PRICE_ID;
 if(!/^price_\w+$/.test(solo||'')||!/^price_\w+$/.test(team||'')||solo===team)throw Error('Distinct plan prices required');
 return [{id:'solo',name:'Solo',amount:799,price:solo,maxStaff:1,staffAccess:false},{id:'team',name:'Team',amount:1499,price:team,maxStaff:cap,staffAccess:true}];
}
export function publicPlans(config){return config?.plans?.map(({price,...plan})=>plan)}
export function planForSubscription(subscription,config){
 const items=subscription?.items?.data;
 if(subscription?.livemode!==(config.mode==='live')||!Array.isArray(items)||items.length!==1||items[0].quantity!==1)return null;
 const price=typeof items[0].price==='string'?items[0].price:items[0].price?.id;
 return config.plans?.find(p=>p.price===price)||null;
}
export function selectPlan(config,id){return config.plans?.find(p=>p.id===id)||null}
export function fitsPlan(state,staffMemberships,plan){return state.staff.length<=plan.maxStaff&&(plan.staffAccess||staffMemberships===0)}
