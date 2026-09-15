// Japanese chassis-code decode — the recon half of the "Decode" button.
//
// WHY THIS EXISTS. utils/vinDecode.js asks NHTSA, the US federal vehicle
// catalogue, which needs a 17-character VIN. A Japanese import does not have
// one: its grant carries a short chassis code plus a serial — FL5-1234567,
// AGH30-0123456, ZVW30W-1234567 (the exact shape ImportStockPage already
// parses out of a dealer's stock sheet). So isLikelyVin() was false for every
// recon unit and the Decode button sat permanently disabled: no request, no
// message, nothing happened. Recon is precisely where the chassis field
// matters, so the decode that segment needs is this one — a local table, no
// network, works offline, instant.
//
// WHAT A CHASSIS CODE CAN AND CANNOT TELL YOU. It identifies the model and the
// GENERATION. It does not encode a build year, so this returns a year RANGE
// and never invents a year. Specs (cc / bhp / cylinders / doors / seats) are
// filled afterwards by utils/carSpecs.js from brand + model + year — the same
// table the rest of the form already uses. One spec table, no drift.
//
// Year ranges are generation boundaries and are approximate at the edges;
// everything filled here stays editable, same stance as carSpecs.js.
//
// EXTENDING: add a `CODE: { brand, model, from, to, alt }` row under the right
// brand. `to: null` means "current". `alt` is the other name the same car is
// sold under (Alphard/Vellfire, Rush/Aruz) — it is shown to the seller, never
// written to the form. Keep keys UPPERCASE and 3+ characters (see LOOKUP).
import { chassisSearch } from './chassisCodes.js';

const JDM = {
  // ─── Toyota ──────────────────────────────────────────────────────────────
  ANH20:  { brand: 'Toyota', model: 'Alphard', from: 2008, to: 2015, alt: 'Vellfire' },
  GGH20:  { brand: 'Toyota', model: 'Alphard', from: 2008, to: 2015, alt: 'Vellfire' },
  AGH30:  { brand: 'Toyota', model: 'Alphard', from: 2015, to: 2023, alt: 'Vellfire' },
  GGH30:  { brand: 'Toyota', model: 'Alphard', from: 2015, to: 2023, alt: 'Vellfire' },
  AYH30:  { brand: 'Toyota', model: 'Alphard', from: 2015, to: 2023, alt: 'Vellfire (hybrid)' },
  AGH40:  { brand: 'Toyota', model: 'Alphard', from: 2023, to: null, alt: 'Vellfire' },
  TAHA40: { brand: 'Toyota', model: 'Alphard', from: 2023, to: null, alt: 'Vellfire (hybrid)' },
  ANH25:  { brand: 'Toyota', model: 'Alphard', from: 2008, to: 2015, alt: 'Vellfire' },
  GGH25:  { brand: 'Toyota', model: 'Alphard', from: 2008, to: 2015, alt: 'Vellfire' },
  AGH35:  { brand: 'Toyota', model: 'Alphard', from: 2015, to: 2023, alt: 'Vellfire' },
  GGH35:  { brand: 'Toyota', model: 'Alphard', from: 2015, to: 2023, alt: 'Vellfire' },
  ACU30:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  MCU30:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  ACU35:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  MCU35:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  GSU30:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  GSU35:  { brand: 'Toyota', model: 'Harrier', from: 2003, to: 2013 },
  ZSU60:  { brand: 'Toyota', model: 'Harrier', from: 2013, to: 2020 },
  ZSU65:  { brand: 'Toyota', model: 'Harrier', from: 2013, to: 2020 },
  ASU60:  { brand: 'Toyota', model: 'Harrier', from: 2013, to: 2020 },
  ASU65:  { brand: 'Toyota', model: 'Harrier', from: 2013, to: 2020 },
  AVU65:  { brand: 'Toyota', model: 'Harrier', from: 2013, to: 2020, alt: 'hybrid' },
  MXUA80: { brand: 'Toyota', model: 'Harrier', from: 2020, to: null },
  MXUA85: { brand: 'Toyota', model: 'Harrier', from: 2020, to: null },
  AXUH80: { brand: 'Toyota', model: 'Harrier', from: 2020, to: null, alt: 'hybrid' },
  AXUH85: { brand: 'Toyota', model: 'Harrier', from: 2020, to: null, alt: 'hybrid' },
  ACR50:  { brand: 'Toyota', model: 'Estima', from: 2006, to: 2019 },
  GSR50:  { brand: 'Toyota', model: 'Estima', from: 2006, to: 2019 },
  ACR55:  { brand: 'Toyota', model: 'Estima', from: 2006, to: 2019 },
  GSR55:  { brand: 'Toyota', model: 'Estima', from: 2006, to: 2019 },
  AHR20:  { brand: 'Toyota', model: 'Estima', from: 2006, to: 2019, alt: 'hybrid' },
  ZRR70:  { brand: 'Toyota', model: 'Voxy', from: 2007, to: 2014, alt: 'Noah' },
  ZRR80:  { brand: 'Toyota', model: 'Voxy', from: 2014, to: 2022, alt: 'Noah' },
  ZWR80:  { brand: 'Toyota', model: 'Voxy', from: 2014, to: 2022, alt: 'Noah (hybrid)' },
  MZRA90: { brand: 'Toyota', model: 'Voxy', from: 2022, to: null, alt: 'Noah' },
  ZWR90:  { brand: 'Toyota', model: 'Voxy', from: 2022, to: null, alt: 'Noah (hybrid)' },
  NHW20:  { brand: 'Toyota', model: 'Prius', from: 2003, to: 2009 },
  ZVW30:  { brand: 'Toyota', model: 'Prius', from: 2009, to: 2015 },
  ZVW35:  { brand: 'Toyota', model: 'Prius', from: 2009, to: 2015 },
  ZVW40:  { brand: 'Toyota', model: 'Prius Alpha', from: 2011, to: 2021 },
  ZVW41:  { brand: 'Toyota', model: 'Prius Alpha', from: 2011, to: 2021 },
  ZVW50:  { brand: 'Toyota', model: 'Prius', from: 2015, to: 2022 },
  ZVW51:  { brand: 'Toyota', model: 'Prius', from: 2015, to: 2022 },
  ZVW55:  { brand: 'Toyota', model: 'Prius', from: 2015, to: 2022 },
  MXWH60: { brand: 'Toyota', model: 'Prius', from: 2022, to: null },
  NHP10:  { brand: 'Toyota', model: 'Aqua', from: 2011, to: 2021 },
  MXPK10: { brand: 'Toyota', model: 'Aqua', from: 2021, to: null },
  MXPK11: { brand: 'Toyota', model: 'Aqua', from: 2021, to: null },
  NGX10:  { brand: 'Toyota', model: 'C-HR', from: 2016, to: 2023 },
  NGX50:  { brand: 'Toyota', model: 'C-HR', from: 2016, to: 2023 },
  ZYX10:  { brand: 'Toyota', model: 'C-HR', from: 2016, to: 2023, alt: 'hybrid' },
  ZYX11:  { brand: 'Toyota', model: 'C-HR', from: 2016, to: 2023, alt: 'hybrid' },
  NHP170: { brand: 'Toyota', model: 'Sienta', from: 2015, to: 2022, alt: 'hybrid' },
  NSP170: { brand: 'Toyota', model: 'Sienta', from: 2015, to: 2022 },
  NCP175: { brand: 'Toyota', model: 'Sienta', from: 2015, to: 2022 },
  MXPC10: { brand: 'Toyota', model: 'Sienta', from: 2022, to: null },
  MXPL10: { brand: 'Toyota', model: 'Sienta', from: 2022, to: null, alt: 'hybrid' },
  M900A:  { brand: 'Toyota', model: 'Roomy', from: 2016, to: null, alt: 'Daihatsu Thor' },
  M910A:  { brand: 'Toyota', model: 'Roomy', from: 2016, to: null, alt: 'Daihatsu Thor' },
  A200A:  { brand: 'Toyota', model: 'Raize', from: 2019, to: null, alt: 'Daihatsu Rocky / Perodua Ativa' },
  A210A:  { brand: 'Toyota', model: 'Raize', from: 2019, to: null, alt: 'Daihatsu Rocky / Perodua Ativa' },
  NCP131: { brand: 'Toyota', model: 'Yaris', from: 2010, to: 2020, alt: 'Vitz' },
  KSP130: { brand: 'Toyota', model: 'Yaris', from: 2010, to: 2020, alt: 'Vitz' },
  NSP130: { brand: 'Toyota', model: 'Yaris', from: 2010, to: 2020, alt: 'Vitz' },
  MXPA10: { brand: 'Toyota', model: 'Yaris', from: 2020, to: null },
  KSP210: { brand: 'Toyota', model: 'Yaris', from: 2020, to: null },
  MXPB10: { brand: 'Toyota', model: 'Yaris Cross', from: 2020, to: null },
  MXPJ10: { brand: 'Toyota', model: 'Yaris Cross', from: 2020, to: null, alt: 'hybrid' },
  ZSA44:  { brand: 'Toyota', model: 'RAV4', from: 2013, to: 2018 },
  MXAA54: { brand: 'Toyota', model: 'RAV4', from: 2018, to: null },
  AXAH54: { brand: 'Toyota', model: 'RAV4', from: 2018, to: null, alt: 'hybrid' },
  URJ200: { brand: 'Toyota', model: 'Land Cruiser', from: 2007, to: 2021 },
  UZJ200: { brand: 'Toyota', model: 'Land Cruiser', from: 2007, to: 2021 },
  VDJ200: { brand: 'Toyota', model: 'Land Cruiser', from: 2007, to: 2021, alt: 'diesel' },
  VJA300: { brand: 'Toyota', model: 'Land Cruiser', from: 2021, to: null },
  FJA300: { brand: 'Toyota', model: 'Land Cruiser', from: 2021, to: null, alt: 'diesel' },
  TRJ150: { brand: 'Toyota', model: 'Prado', from: 2009, to: 2024 },
  GDJ150: { brand: 'Toyota', model: 'Prado', from: 2009, to: 2024, alt: 'diesel' },
  KDH200: { brand: 'Toyota', model: 'Hiace', from: 2004, to: 2019 },
  TRH200: { brand: 'Toyota', model: 'Hiace', from: 2004, to: 2019 },
  GDH300: { brand: 'Toyota', model: 'Hiace', from: 2019, to: null },
  KDH300: { brand: 'Toyota', model: 'Hiace', from: 2019, to: null },
  ACV40:  { brand: 'Toyota', model: 'Camry', from: 2006, to: 2011 },
  GSV40:  { brand: 'Toyota', model: 'Camry', from: 2006, to: 2011 },
  AVV50:  { brand: 'Toyota', model: 'Camry', from: 2011, to: 2017, alt: 'hybrid' },
  ASV50:  { brand: 'Toyota', model: 'Camry', from: 2011, to: 2017 },
  AXVH70: { brand: 'Toyota', model: 'Camry', from: 2017, to: null },
  ASV70:  { brand: 'Toyota', model: 'Camry', from: 2017, to: null },
  ZRE142: { brand: 'Toyota', model: 'Corolla', from: 2006, to: 2012, alt: 'Altis' },
  NZE141: { brand: 'Toyota', model: 'Corolla', from: 2006, to: 2012, alt: 'Altis' },
  ZRE172: { brand: 'Toyota', model: 'Corolla', from: 2012, to: 2018, alt: 'Altis' },
  NRE160: { brand: 'Toyota', model: 'Corolla', from: 2012, to: 2018, alt: 'Altis' },
  ZRE212: { brand: 'Toyota', model: 'Corolla', from: 2018, to: null, alt: 'Altis' },
  ZWE211: { brand: 'Toyota', model: 'Corolla', from: 2018, to: null, alt: 'Altis (hybrid)' },
  ZNE10:  { brand: 'Toyota', model: 'Wish', from: 2003, to: 2009 },
  ANE11:  { brand: 'Toyota', model: 'Wish', from: 2003, to: 2009 },
  ZGE20:  { brand: 'Toyota', model: 'Wish', from: 2009, to: 2017 },
  ZGE25:  { brand: 'Toyota', model: 'Wish', from: 2009, to: 2017 },
  GRX120: { brand: 'Toyota', model: 'Mark X', from: 2004, to: 2009 },
  GRX130: { brand: 'Toyota', model: 'Mark X', from: 2009, to: 2019 },
  GRS200: { brand: 'Toyota', model: 'Crown', from: 2008, to: 2012 },
  GRS210: { brand: 'Toyota', model: 'Crown', from: 2012, to: 2018 },
  AWS210: { brand: 'Toyota', model: 'Crown', from: 2012, to: 2018, alt: 'hybrid' },
  ARS220: { brand: 'Toyota', model: 'Crown', from: 2018, to: null },
  AZSH20: { brand: 'Toyota', model: 'Crown', from: 2018, to: null, alt: 'hybrid' },
  GUN125: { brand: 'Toyota', model: 'Hilux', from: 2015, to: null },
  GUN126: { brand: 'Toyota', model: 'Hilux', from: 2015, to: null },
  TGN51:  { brand: 'Toyota', model: 'Fortuner', from: 2008, to: 2015 },
  KUN60:  { brand: 'Toyota', model: 'Fortuner', from: 2008, to: 2015 },
  GUN156: { brand: 'Toyota', model: 'Fortuner', from: 2015, to: null },
  GUN166: { brand: 'Toyota', model: 'Fortuner', from: 2015, to: null },
  TGN40:  { brand: 'Toyota', model: 'Innova', from: 2005, to: 2015 },
  TGN140: { brand: 'Toyota', model: 'Innova', from: 2015, to: null },
  F800:   { brand: 'Toyota', model: 'Rush', from: 2017, to: null, alt: 'Daihatsu Terios / Perodua Aruz' },
  JZA80:  { brand: 'Toyota', model: 'Supra', from: 1993, to: 2002 },
  DB02:   { brand: 'Toyota', model: 'Supra', from: 2019, to: null },
  DB22:   { brand: 'Toyota', model: 'Supra', from: 2019, to: null },
  DB42:   { brand: 'Toyota', model: 'Supra', from: 2019, to: null },
  GXPA16: { brand: 'Toyota', model: 'GR Yaris', from: 2020, to: null },
  ZN6:    { brand: 'Toyota', model: '86', from: 2012, to: 2020, alt: 'Subaru BRZ' },
  ZN8:    { brand: 'Toyota', model: 'GR86', from: 2021, to: null, alt: 'Subaru BRZ' },

  // ─── Lexus ───────────────────────────────────────────────────────────────
  GSE20:  { brand: 'Lexus', model: 'IS', from: 2005, to: 2013 },
  GSE30:  { brand: 'Lexus', model: 'IS', from: 2013, to: null },
  AVE30:  { brand: 'Lexus', model: 'IS', from: 2013, to: null, alt: '300h' },
  ASE30:  { brand: 'Lexus', model: 'IS', from: 2013, to: null },
  GGL10:  { brand: 'Lexus', model: 'RX', from: 2009, to: 2015 },
  GYL10:  { brand: 'Lexus', model: 'RX', from: 2009, to: 2015, alt: '450h' },
  GGL20:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022 },
  GYL20:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022, alt: '450h' },
  GGL25:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022 },
  GYL25:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022, alt: '450h' },
  AGL20:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022, alt: 'RX300 (2.0 turbo)' },
  AGL25:  { brand: 'Lexus', model: 'RX', from: 2015, to: 2022, alt: 'RX300 (2.0 turbo)' },
  TALA10: { brand: 'Lexus', model: 'RX', from: 2022, to: null },
  TALA15: { brand: 'Lexus', model: 'RX', from: 2022, to: null },
  AALH10: { brand: 'Lexus', model: 'RX', from: 2022, to: null, alt: 'hybrid' },
  AGZ10:  { brand: 'Lexus', model: 'NX', from: 2014, to: 2021 },
  AYZ10:  { brand: 'Lexus', model: 'NX', from: 2014, to: 2021, alt: '300h' },
  AAZH20: { brand: 'Lexus', model: 'NX', from: 2021, to: null, alt: 'hybrid' },
  TAZA20: { brand: 'Lexus', model: 'NX', from: 2021, to: null },
  MZAA10: { brand: 'Lexus', model: 'UX', from: 2018, to: null },
  MZAH10: { brand: 'Lexus', model: 'UX', from: 2018, to: null, alt: '250h' },
  AXZH10: { brand: 'Lexus', model: 'ES', from: 2018, to: null },
  ZWA10:  { brand: 'Lexus', model: 'CT', from: 2011, to: 2022 },
  USF40:  { brand: 'Lexus', model: 'LS', from: 2006, to: 2017 },
  VXFA50: { brand: 'Lexus', model: 'LS', from: 2017, to: null },
  URJ201: { brand: 'Lexus', model: 'LX', from: 2007, to: 2021 },
  VJA310: { brand: 'Lexus', model: 'LX', from: 2021, to: null },
  URZ100: { brand: 'Lexus', model: 'LC', from: 2017, to: null },
  ASC10:  { brand: 'Lexus', model: 'RC', from: 2014, to: null },
  GSC10:  { brand: 'Lexus', model: 'RC', from: 2014, to: null, alt: 'RC F' },

  // ─── Honda ───────────────────────────────────────────────────────────────
  RU1: { brand: 'Honda', model: 'Vezel', from: 2013, to: 2021, alt: 'HR-V' },
  RU2: { brand: 'Honda', model: 'Vezel', from: 2013, to: 2021, alt: 'HR-V' },
  RU3: { brand: 'Honda', model: 'Vezel', from: 2013, to: 2021, alt: 'HR-V (hybrid)' },
  RU4: { brand: 'Honda', model: 'Vezel', from: 2013, to: 2021, alt: 'HR-V (hybrid)' },
  RV3: { brand: 'Honda', model: 'Vezel', from: 2021, to: null, alt: 'HR-V' },
  RV5: { brand: 'Honda', model: 'Vezel', from: 2021, to: null, alt: 'HR-V (e:HEV)' },
  RV6: { brand: 'Honda', model: 'Vezel', from: 2021, to: null, alt: 'HR-V (e:HEV)' },
  GE6: { brand: 'Honda', model: 'Jazz', from: 2007, to: 2013, alt: 'Fit' },
  GE8: { brand: 'Honda', model: 'Jazz', from: 2007, to: 2013, alt: 'Fit' },
  GK3: { brand: 'Honda', model: 'Jazz', from: 2013, to: 2020, alt: 'Fit' },
  GK5: { brand: 'Honda', model: 'Jazz', from: 2013, to: 2020, alt: 'Fit' },
  GP5: { brand: 'Honda', model: 'Jazz', from: 2013, to: 2020, alt: 'Fit (hybrid)' },
  GP6: { brand: 'Honda', model: 'Jazz', from: 2013, to: 2020, alt: 'Fit (hybrid)' },
  GR1: { brand: 'Honda', model: 'Jazz', from: 2020, to: null, alt: 'Fit' },
  GR3: { brand: 'Honda', model: 'Jazz', from: 2020, to: null, alt: 'Fit (e:HEV)' },
  GR8: { brand: 'Honda', model: 'Jazz', from: 2020, to: null, alt: 'Fit (e:HEV)' },
  GB3: { brand: 'Honda', model: 'Freed', from: 2008, to: 2016 },
  GB4: { brand: 'Honda', model: 'Freed', from: 2008, to: 2016 },
  GB5: { brand: 'Honda', model: 'Freed', from: 2016, to: null },
  GB6: { brand: 'Honda', model: 'Freed', from: 2016, to: null },
  GB7: { brand: 'Honda', model: 'Freed', from: 2016, to: null, alt: 'hybrid' },
  GB8: { brand: 'Honda', model: 'Freed', from: 2016, to: null, alt: 'hybrid' },
  GP8: { brand: 'Honda', model: 'Shuttle', from: 2015, to: 2022, alt: 'hybrid' },
  GK8: { brand: 'Honda', model: 'Shuttle', from: 2015, to: 2022 },
  GK9: { brand: 'Honda', model: 'Shuttle', from: 2015, to: 2022 },
  RK1: { brand: 'Honda', model: 'Stepwgn', from: 2009, to: 2015 },
  RK5: { brand: 'Honda', model: 'Stepwgn', from: 2009, to: 2015 },
  RP1: { brand: 'Honda', model: 'Stepwgn', from: 2015, to: 2022 },
  RP3: { brand: 'Honda', model: 'Stepwgn', from: 2015, to: 2022 },
  RP5: { brand: 'Honda', model: 'Stepwgn', from: 2015, to: 2022, alt: 'hybrid' },
  RP6: { brand: 'Honda', model: 'Stepwgn', from: 2022, to: null },
  RP8: { brand: 'Honda', model: 'Stepwgn', from: 2022, to: null, alt: 'e:HEV' },
  RB1: { brand: 'Honda', model: 'Odyssey', from: 2003, to: 2008 },
  RB3: { brand: 'Honda', model: 'Odyssey', from: 2008, to: 2013 },
  RB4: { brand: 'Honda', model: 'Odyssey', from: 2008, to: 2013 },
  RC1: { brand: 'Honda', model: 'Odyssey', from: 2013, to: null },
  RC2: { brand: 'Honda', model: 'Odyssey', from: 2013, to: null },
  RC4: { brand: 'Honda', model: 'Odyssey', from: 2013, to: null, alt: 'hybrid' },
  RN1: { brand: 'Honda', model: 'Stream', from: 2000, to: 2006 },
  RN3: { brand: 'Honda', model: 'Stream', from: 2000, to: 2006 },
  RN6: { brand: 'Honda', model: 'Stream', from: 2007, to: 2014 },
  RN8: { brand: 'Honda', model: 'Stream', from: 2007, to: 2014 },
  RE3: { brand: 'Honda', model: 'CR-V', from: 2006, to: 2011 },
  RE4: { brand: 'Honda', model: 'CR-V', from: 2006, to: 2011 },
  RM1: { brand: 'Honda', model: 'CR-V', from: 2011, to: 2016 },
  RM4: { brand: 'Honda', model: 'CR-V', from: 2011, to: 2016 },
  RW1: { brand: 'Honda', model: 'CR-V', from: 2016, to: 2022 },
  RW2: { brand: 'Honda', model: 'CR-V', from: 2016, to: 2022 },
  RS3: { brand: 'Honda', model: 'CR-V', from: 2022, to: null },
  RS4: { brand: 'Honda', model: 'CR-V', from: 2022, to: null, alt: 'e:HEV' },
  JF1: { brand: 'Honda', model: 'N-Box', from: 2011, to: 2017 },
  JF2: { brand: 'Honda', model: 'N-Box', from: 2011, to: 2017 },
  JF3: { brand: 'Honda', model: 'N-Box', from: 2017, to: 2023 },
  JF4: { brand: 'Honda', model: 'N-Box', from: 2017, to: 2023 },
  JW5: { brand: 'Honda', model: 'S660', from: 2015, to: 2022 },
  ZE2: { brand: 'Honda', model: 'Insight', from: 2009, to: 2014 },
  ZE4: { brand: 'Honda', model: 'Insight', from: 2018, to: 2022 },
  CU2: { brand: 'Honda', model: 'Accord', from: 2008, to: 2013 },
  CP1: { brand: 'Honda', model: 'Accord', from: 2008, to: 2013 },
  CP2: { brand: 'Honda', model: 'Accord', from: 2008, to: 2013 },
  CR6: { brand: 'Honda', model: 'Accord', from: 2013, to: 2020, alt: 'hybrid' },
  CR7: { brand: 'Honda', model: 'Accord', from: 2013, to: 2020 },
  CR2: { brand: 'Honda', model: 'Accord', from: 2013, to: 2020 },
  CV3: { brand: 'Honda', model: 'Accord', from: 2020, to: null },
  CV1: { brand: 'Honda', model: 'Accord', from: 2020, to: null },
  FD1: { brand: 'Honda', model: 'Civic', from: 2005, to: 2011 },
  FD2: { brand: 'Honda', model: 'Civic', from: 2007, to: 2011, alt: 'Type R' },
  FK2: { brand: 'Honda', model: 'Civic', from: 2015, to: 2017, alt: 'Type R' },
  FK7: { brand: 'Honda', model: 'Civic', from: 2015, to: 2021 },
  FK8: { brand: 'Honda', model: 'Civic', from: 2017, to: 2021, alt: 'Type R' },
  FC1: { brand: 'Honda', model: 'Civic', from: 2015, to: 2021 },
  FE1: { brand: 'Honda', model: 'Civic', from: 2021, to: null },
  FL1: { brand: 'Honda', model: 'Civic', from: 2021, to: null },
  FL5: { brand: 'Honda', model: 'Civic', from: 2022, to: null, alt: 'Type R' },
  DC5: { brand: 'Honda', model: 'Integra', from: 2001, to: 2006, alt: 'Type R' },
  AP1: { brand: 'Honda', model: 'S2000', from: 1999, to: 2005 },
  AP2: { brand: 'Honda', model: 'S2000', from: 2005, to: 2009 },

  // ─── Nissan ──────────────────────────────────────────────────────────────
  C25:  { brand: 'Nissan', model: 'Serena', from: 2005, to: 2010 },
  C26:  { brand: 'Nissan', model: 'Serena', from: 2010, to: 2016 },
  C27:  { brand: 'Nissan', model: 'Serena', from: 2016, to: 2022 },
  C28:  { brand: 'Nissan', model: 'Serena', from: 2022, to: null },
  T31:  { brand: 'Nissan', model: 'X-Trail', from: 2007, to: 2013 },
  T32:  { brand: 'Nissan', model: 'X-Trail', from: 2013, to: 2022 },
  T33:  { brand: 'Nissan', model: 'X-Trail', from: 2022, to: null },
  E11:  { brand: 'Nissan', model: 'Note', from: 2005, to: 2012 },
  NE11: { brand: 'Nissan', model: 'Note', from: 2005, to: 2012 },
  // ZE11 needs its own exact entry, not just the prefix match ZE11 would
  // otherwise fall through to: ZE1 (Leaf, below) is a shorter key, and the
  // longest-key-first prefix loop in decodeChassis() would have matched
  // "ZE11".startsWith("ZE1") and silently decoded a Note as a Leaf.
  ZE11: { brand: 'Nissan', model: 'Note', from: 2005, to: 2012 },
  E12:  { brand: 'Nissan', model: 'Note', from: 2012, to: 2020 },
  NE12: { brand: 'Nissan', model: 'Note', from: 2012, to: 2020 },
  HE12: { brand: 'Nissan', model: 'Note', from: 2012, to: 2020, alt: 'hybrid (e-Power)' },
  E13:  { brand: 'Nissan', model: 'Note', from: 2020, to: null },
  J31:  { brand: 'Nissan', model: 'Teana', from: 2003, to: 2008 },
  J32:  { brand: 'Nissan', model: 'Teana', from: 2009, to: 2013 },
  L33:  { brand: 'Nissan', model: 'Teana', from: 2014, to: 2019 },
  B17:  { brand: 'Nissan', model: 'Sylphy', from: 2014, to: 2019 },
  E51:  { brand: 'Nissan', model: 'Elgrand', from: 2002, to: 2010 },
  E52:  { brand: 'Nissan', model: 'Elgrand', from: 2010, to: null },
  AZE0: { brand: 'Nissan', model: 'Leaf', from: 2010, to: 2017 },
  ZE1:  { brand: 'Nissan', model: 'Leaf', from: 2017, to: null },
  F15:  { brand: 'Nissan', model: 'Juke', from: 2010, to: 2019 },
  YF15: { brand: 'Nissan', model: 'Juke', from: 2010, to: 2019 },
  NF15: { brand: 'Nissan', model: 'Juke', from: 2010, to: 2019 },
  K12:  { brand: 'Nissan', model: 'March', from: 2002, to: 2010 },
  AK12: { brand: 'Nissan', model: 'March', from: 2002, to: 2010 },
  BK12: { brand: 'Nissan', model: 'March', from: 2002, to: 2010 },
  K13:  { brand: 'Nissan', model: 'March', from: 2010, to: 2022 },
  N16:  { brand: 'Nissan', model: 'Sentra', from: 2000, to: 2006 },
  V37:  { brand: 'Nissan', model: 'Skyline', from: 2013, to: null },
  R35:  { brand: 'Nissan', model: 'GT-R', from: 2007, to: null },
  D40:  { brand: 'Nissan', model: 'Navara', from: 2005, to: 2014 },
  D23:  { brand: 'Nissan', model: 'Navara', from: 2015, to: null, alt: 'NP300' },

  // ─── Mazda ───────────────────────────────────────────────────────────────
  DE3FS: { brand: 'Mazda', model: 'Mazda 2', from: 2007, to: 2014, alt: 'Demio' },
  DE5FS: { brand: 'Mazda', model: 'Mazda 2', from: 2007, to: 2014, alt: 'Demio' },
  DJ3FS: { brand: 'Mazda', model: 'Mazda 2', from: 2014, to: 2022, alt: 'Demio' },
  DJ5FS: { brand: 'Mazda', model: 'Mazda 2', from: 2014, to: 2022, alt: 'Demio (diesel)' },
  BM5FS: { brand: 'Mazda', model: 'Mazda 3', from: 2013, to: 2019, alt: 'Axela' },
  BMLFS: { brand: 'Mazda', model: 'Mazda 3', from: 2013, to: 2019, alt: 'Axela (diesel)' },
  GJ2FP: { brand: 'Mazda', model: 'Mazda 6', from: 2012, to: null, alt: 'Atenza (diesel)' },
  GJ5FP: { brand: 'Mazda', model: 'Mazda 6', from: 2012, to: null, alt: 'Atenza' },
  KE2FW: { brand: 'Mazda', model: 'CX-5', from: 2012, to: 2017, alt: 'diesel' },
  KE5AW: { brand: 'Mazda', model: 'CX-5', from: 2012, to: 2017 },
  KF2P:  { brand: 'Mazda', model: 'CX-5', from: 2017, to: null, alt: 'diesel' },
  KF5P:  { brand: 'Mazda', model: 'CX-5', from: 2017, to: null },
  DK5FW: { brand: 'Mazda', model: 'CX-3', from: 2015, to: null },
  SE3P:  { brand: 'Mazda', model: 'RX-8', from: 2003, to: 2012 },
  NCEC:  { brand: 'Mazda', model: 'MX-5', from: 2005, to: 2015 },
  ND5RC: { brand: 'Mazda', model: 'MX-5', from: 2015, to: null },
  NA6CE: { brand: 'Mazda', model: 'MX-5', from: 1989, to: 1997 },
  NA8C:  { brand: 'Mazda', model: 'MX-5', from: 1989, to: 1997 },
  NB6C:  { brand: 'Mazda', model: 'MX-5', from: 1998, to: 2004 },
  NB8C:  { brand: 'Mazda', model: 'MX-5', from: 1998, to: 2004 },

  // ─── Subaru ──────────────────────────────────────────────────────────────
  SH5: { brand: 'Subaru', model: 'Forester', from: 2008, to: 2012 },
  SH9: { brand: 'Subaru', model: 'Forester', from: 2008, to: 2012 },
  SJ5: { brand: 'Subaru', model: 'Forester', from: 2012, to: 2018 },
  SJG: { brand: 'Subaru', model: 'Forester', from: 2012, to: 2018, alt: 'XT' },
  SK5: { brand: 'Subaru', model: 'Forester', from: 2018, to: null },
  SK9: { brand: 'Subaru', model: 'Forester', from: 2018, to: null },
  SKE: { brand: 'Subaru', model: 'Forester', from: 2018, to: null, alt: 'e-Boxer' },
  GP7: { brand: 'Subaru', model: 'XV', from: 2011, to: 2017, alt: 'also the Honda Shuttle code' },
  GT3: { brand: 'Subaru', model: 'XV', from: 2017, to: 2022 },
  GT7: { brand: 'Subaru', model: 'XV', from: 2017, to: 2022 },
  VM4: { brand: 'Subaru', model: 'Levorg', from: 2014, to: 2020 },
  VMG: { brand: 'Subaru', model: 'Levorg', from: 2014, to: 2020 },
  VN5: { brand: 'Subaru', model: 'Levorg', from: 2020, to: null },
  GDB: { brand: 'Subaru', model: 'WRX', from: 2000, to: 2007, alt: 'STI' },
  GRB: { brand: 'Subaru', model: 'WRX', from: 2007, to: 2014, alt: 'STI' },
  VAB: { brand: 'Subaru', model: 'WRX', from: 2014, to: 2021, alt: 'STI' },
  VAG: { brand: 'Subaru', model: 'WRX', from: 2014, to: 2021, alt: 'S4' },
  ZC6: { brand: 'Subaru', model: 'BRZ', from: 2012, to: 2020 },
  ZD8: { brand: 'Subaru', model: 'BRZ', from: 2021, to: null },

  // ─── Mitsubishi ──────────────────────────────────────────────────────────
  CT9A: { brand: 'Mitsubishi', model: 'Evo', from: 2001, to: 2007, alt: 'Lancer Evolution VII-IX' },
  CZ4A: { brand: 'Mitsubishi', model: 'Evo', from: 2007, to: 2016, alt: 'Lancer Evolution X' },
  CY4A: { brand: 'Mitsubishi', model: 'Lancer', from: 2008, to: 2017 },
  CW5W: { brand: 'Mitsubishi', model: 'Outlander', from: 2005, to: 2012 },
  GF7W: { brand: 'Mitsubishi', model: 'Outlander', from: 2012, to: 2021 },
  GF8W: { brand: 'Mitsubishi', model: 'Outlander', from: 2012, to: 2021 },
  GN0W: { brand: 'Mitsubishi', model: 'Outlander', from: 2021, to: null },
  CV1W: { brand: 'Mitsubishi', model: 'Delica', from: 2007, to: null, alt: 'D:5 diesel' },
  CV5W: { brand: 'Mitsubishi', model: 'Delica', from: 2007, to: null, alt: 'D:5' },
  GA3W: { brand: 'Mitsubishi', model: 'ASX', from: 2010, to: null, alt: 'RVR' },
  GA4W: { brand: 'Mitsubishi', model: 'ASX', from: 2010, to: null, alt: 'RVR' },
  KL1T: { brand: 'Mitsubishi', model: 'Triton', from: 2018, to: null },
  A05A: { brand: 'Mitsubishi', model: 'Mirage', from: 2012, to: 2019 },
  Z27A: { brand: 'Mitsubishi', model: 'Colt', from: 2005, to: 2012 },
  Z28A: { brand: 'Mitsubishi', model: 'Colt', from: 2005, to: 2012 },
  V68W: { brand: 'Mitsubishi', model: 'Pajero', from: 2000, to: 2006 },
  V78W: { brand: 'Mitsubishi', model: 'Pajero', from: 2000, to: 2006 },
  V88W: { brand: 'Mitsubishi', model: 'Pajero', from: 2007, to: 2021 },
  V98W: { brand: 'Mitsubishi', model: 'Pajero', from: 2007, to: 2021 },

  // ─── Daihatsu (kei recon + the Perodua donor cars) ───────────────────────
  L375S: { brand: 'Daihatsu', model: 'Tanto', from: 2007, to: 2013 },
  LA600S: { brand: 'Daihatsu', model: 'Tanto', from: 2013, to: 2019 },
  LA650S: { brand: 'Daihatsu', model: 'Tanto', from: 2019, to: null },
  LA100S: { brand: 'Daihatsu', model: 'Move', from: 2010, to: 2014 },
  LA150S: { brand: 'Daihatsu', model: 'Move', from: 2014, to: null },
  LA800S: { brand: 'Daihatsu', model: 'Move Canbus', from: 2016, to: 2022 },
  LA810S: { brand: 'Daihatsu', model: 'Move Canbus', from: 2016, to: 2022 },
  LA850S: { brand: 'Daihatsu', model: 'Move Canbus', from: 2022, to: null },
  LA860S: { brand: 'Daihatsu', model: 'Move Canbus', from: 2022, to: null },
  L275S: { brand: 'Daihatsu', model: 'Mira', from: 2006, to: 2018 },
  LA350S: { brand: 'Daihatsu', model: 'Mira', from: 2018, to: null, alt: 'e:S' },
  S321V: { brand: 'Daihatsu', model: 'Hijet', from: 2004, to: 2021 },
  S331V: { brand: 'Daihatsu', model: 'Hijet', from: 2004, to: 2021 },
  S700V: { brand: 'Daihatsu', model: 'Hijet', from: 2021, to: null },
  S710V: { brand: 'Daihatsu', model: 'Hijet', from: 2021, to: null },
  L880K: { brand: 'Daihatsu', model: 'Copen', from: 2002, to: 2012 },
  LA400K: { brand: 'Daihatsu', model: 'Copen', from: 2014, to: null },
  A200S: { brand: 'Daihatsu', model: 'Rocky', from: 2019, to: null, alt: 'Perodua Ativa / Toyota Raize' },
  A210S: { brand: 'Daihatsu', model: 'Rocky', from: 2019, to: null, alt: 'Perodua Ativa / Toyota Raize' },
  M900S: { brand: 'Daihatsu', model: 'Thor', from: 2016, to: null, alt: 'Toyota Roomy' },
  M910S: { brand: 'Daihatsu', model: 'Thor', from: 2016, to: null, alt: 'Toyota Roomy' },
};

// Longest key first, so ZVW30 wins over any shorter prefix and AGH40 is never
// shadowed by AGH4. Keys shorter than MIN_PREFIX only ever match exactly.
const KEYS = Object.keys(JDM).sort((a, b) => b.length - a.length);
const MIN_PREFIX = 3;

// Malaysia's world-manufacturer identifier block. A Perodua or Proton carries a
// full 17-char VIN, so isLikelyVin() passes and the old code sent it to NHTSA —
// a US catalogue that has never heard of either. Recognising the WMI lets us
// skip that round trip and go straight to the local spec table.
const MY_WMI = /^P[LMN]/;

/** Strip the serial and any punctuation: "AGH30W-0123456" -> "AGH30W". */
function rootOf(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  return s.split(/[-/]/)[0].replace(/[^A-Z0-9]/g, '');
}

/** True when the input looks like a Japanese chassis code rather than a VIN. */
export function isChassisCode(raw) {
  const r = rootOf(raw);
  if (!r || r.length < 3 || r.length > 8) return false;
  if (r.length === 17) return false;
  return /^[A-Z0-9]+$/.test(r) && /[A-Z]/.test(r);
}

/** True for a 17-char VIN built in Malaysia (Perodua, Proton). */
export function isMalaysianVin(vin) {
  return MY_WMI.test(String(vin || '').trim().toUpperCase());
}

/**
 * Resolve a chassis code to brand + model + generation years.
 * Returns { brand, model, alt, from, to, code, source } or null.
 * `source` is 'jdm' for the table above, 'generation' for a European code
 * (G82, W205, 992) resolved through the existing chassisCodes index.
 */
export function decodeChassis(raw) {
  const r = rootOf(raw);
  if (!r) return null;

  const exact = JDM[r];
  if (exact) return { ...exact, code: r, source: 'jdm' };

  for (const k of KEYS) {
    if (k.length >= MIN_PREFIX && r.startsWith(k)) {
      return { ...JDM[k], code: k, source: 'jdm' };
    }
  }

  // European generation codes already live in chassisCodes.js — reuse that
  // index rather than keeping a second copy of the same knowledge here.
  const gen = chassisSearch(r);
  if (gen) {
    // chassisSearch keys everything UPPERCASE. Brand is handed back as-is so
    // the caller can match it against its own brand list case-insensitively
    // ("BMW" and "MERCEDES" both resolve there); only the model needs casing.
    return {
      brand: gen.brand,
      model: titleCase(gen.models[0]),
      alt: null,
      from: null,
      to: null,
      code: r,
      source: 'generation',
    };
  }
  return null;
}

// "C-CLASS" -> "C-Class", "3 SERIES" -> "3 Series". Segments that are all
// digits or a letter+digit badge (M4, X5) are left alone.
function titleCase(s) {
  return String(s || '')
    .split(/([\s-])/)
    .map((w) => (/^[A-Z]?\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join('');
}

/** "2015 onwards" / "2013-2020" / "" — for the message under the field. */
// A chassis code can name a variant whose mechanicals are NOT the base model's,
// while carSpecs holds ONE row per generation, for the volume variant. FL5 is a
// Civic Type R (2.0T) against a 1.5T Civic row; AYH30 is the hybrid Alphard
// against a petrol 2.5 row. Filling from the base row would put a confidently
// wrong cc and bhp on a listing, which is worse than the blank it replaces —
// a blank is visibly a blank. Badge-twins (Vellfire, Noah, Aruz) share
// mechanicals, so this reads the alt TEXT rather than merely its presence.
export function specVariantDiffers(hit) {
  return /type\s*r|hybrid|nismo|\bsti\b|\d{3}h\b/i.test(hit?.alt || '');
}

// Which year to ask carSpecs about. The MIDDLE of the generation, never its
// first year: the two tables draw their boundaries a year or two apart (Japan
// gets a generation before Malaysia does), so probing at `from` lands on the
// previous generation's last row — FE1 (from 2021) matched the 2016-2021 Civic
// instead of the 2022+ one. A range's middle cannot collide with either
// neighbour. An open-ended generation has no middle, so take a short step in.
export function specProbeYear(hit) {
  if (!hit?.from) return null;
  return hit.to ? Math.round((hit.from + hit.to) / 2) : hit.from + 2;
}

export function generationYears(hit) {
  if (!hit || !hit.from) return '';
  return hit.to ? `${hit.from}-${hit.to}` : `${hit.from} onwards`;
}
