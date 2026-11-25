// A snapshot of new_car_models (2026-11-25, Peninsular prices) for rendering the brand pages and the
// keyword doc offline: [brand, model, body, [fuels], [prices], seats]. The live site reads the table.
const D = [
  ["Perodua","Axia","Hatchback",["Petrol"],[22000,33900,38500,43000,49000],5], ["Perodua","Bezza","Sedan",["Petrol"],[34580,36580,43980,49980],5],
  ["Perodua","Myvi","Hatchback",["Petrol"],[46500,48500,50900,54900,59900],5], ["Perodua","Ativa","SUV",["Petrol"],[62500,67300,73400],5],
  ["Perodua","Alza","MPV",["Petrol"],[62500,68000,75500],7], ["Perodua","Aruz","SUV",["Petrol"],[68900,73900],7],
  ["Perodua","Traz","SUV",["Petrol"],[76100,81100,82000],5], ["Perodua","QV-E","SUV",["Electric"],[93999],5],
  ["Proton","Saga","Sedan",["Petrol"],[38990,44990,49990],5], ["Proton","Persona","Sedan",["Petrol"],[47800,53300,58300],5],
  ["Proton","e.MAS 5","SUV",["Electric"],[59800,72800],5], ["Proton","S70","Sedan",["Petrol"],[59800,62800,73800,79800,89800,94800],5],
  ["Proton","X50","SUV",["Petrol"],[89800,101800,113300,115299],5], ["Proton","X70","SUV",["Petrol"],[106800,119800],5],
  ["Proton","X90","SUV",["Petrol"],[106800,116800,122800],7], ["Proton","e.MAS 7","SUV",["Electric"],[103800,119800,125800],5],
  ["Proton","e.MAS 7 PHEV","SUV",["Plug-in hybrid"],[109800,123800,129800],5],
  ["Honda","City","Sedan",["Petrol","Hybrid"],[89900,94900,99900,111900],null], ["Honda","City Hatchback","Hatchback",["Petrol","Hybrid"],[95900,100900,112900],null],
  ["Honda","WR-V","SUV",["Petrol"],[94900,98900,104900],null], ["Honda","HR-V","SUV",["Petrol","Hybrid"],[115900,130900,137900,143900],null],
  ["Honda","Civic","Sedan",["Petrol","Hybrid"],[133900,144900,149900,167900],null], ["Honda","CR-V","SUV",["Petrol","Hybrid"],[178200,181900,195900],null],
  ["Honda","e:N1","SUV",["Electric"],[150060],null], ["Honda","Prelude","Coupe",["Hybrid"],[278000],null], ["Honda","Civic Type R","Hatchback",["Petrol"],[399900],null],
  ["Toyota","Veloz","MPV",["Petrol"],[95000],null], ["Toyota","Vios","Sedan",["Petrol","Hybrid"],[90600,96600,103900,109900],null],
  ["Toyota","Yaris","Hatchback",["Petrol"],[88000,91600],null], ["Toyota","Yaris Cross","SUV",["Petrol","Hybrid"],[99900,109900],null],
  ["Toyota","Corolla","Sedan",["Petrol"],[144800,149800],null], ["Toyota","Corolla Cross","SUV",["Petrol","Hybrid"],[133800,140800,148800],null],
  ["Toyota","Hilux","Pickup",["Diesel","Electric"],[117880,119880,149580,163080,173280,226300],null], ["Toyota","Fortuner","SUV",["Diesel","Petrol"],[195880,202880,241880],null],
  ["Toyota","Innova Zenix","MPV",["Petrol","Hybrid"],[165000,202000],null], ["Toyota","Camry","Sedan",["Petrol","Hybrid"],[221800,248800],null],
  ["Toyota","Urban Cruiser","SUV",["Electric"],[198000],null], ["Toyota","bZ4X","SUV",["Electric"],[220000],null],
  ["Toyota","Harrier","SUV",["Hybrid"],[289000],null], ["Toyota","Vellfire","MPV",["Petrol","Hybrid"],[448000,549900],null], ["Toyota","Alphard","MPV",["Petrol"],[548000],null],
  ["BYD","Atto 2","SUV",["Electric"],[100000],5], ["BYD","Seal 6","Sedan",["Electric"],[100000,115800],5], ["BYD","M6","MPV",["Electric"],[109800,123800],7],
  ["BYD","Atto 3","SUV",["Electric"],[125800,138800,149800],5], ["BYD","Seal","Sedan",["Electric"],[171800,191800],5], ["BYD","Sealion 7","SUV",["Electric"],[163800,188800,203800],5],
  ["Jaecoo","J5","SUV",["Petrol"],[108000],5], ["Jaecoo","J5 EV","SUV",["Electric"],[118800],5], ["Jaecoo","J7","SUV",["Petrol"],[138800,148800],5],
  ["Jaecoo","J7 PHEV","SUV",["Plug-in hybrid"],[158800],5], ["Jaecoo","Omoda C9","SUV",["Petrol"],[168800,188900],5],
  ["Jaecoo","Omoda C9 PHEV","SUV",["Plug-in hybrid"],[208800],5], ["Jaecoo","J8","SUV",["Petrol"],[178800,198800],6],
];
export const SAMPLE_ROWS = D.flatMap(([brand, model, body_type, fuels, prices, seats]) =>
  prices.map((p, i) => ({ brand, model, variant: `V${i + 1}`, body_type, fuel_type: fuels[i % fuels.length], price_peninsular: String(p), is_active: true, specs: { seats } })));
