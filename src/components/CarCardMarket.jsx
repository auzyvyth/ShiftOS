import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, MessageCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';

const XDRIVE_WA = '60174155191';

function CarCardMarket({ car }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const brand        = car.brand || 'Unknown';
  const model        = car.model || '';
  const year         = car.year || '';
  const price        = car.selling_price || 0;
  const mileage      = car.mileage || null;
  const transmission = car.transmission || null;
  const fuelType     = car.fuel_type || null;
  const isSold       = (car.status || '') === 'sold';

  const image   = !imgError && Array.isArray(car.images) && car.images[0] || null;
  const normalTx = ['Auto','Automatic','AT'].includes(transmission) ? 'Auto'
    : ['Manual','MT'].includes(transmission) ? 'Manual'
    : transmission || null;

  const title = [year, brand, model].filter(Boolean).join(' ');

  const waText   = `Hi, I'm interested in the ${title}. Can you share more details?`;
  const waNumber = (car.dealer?.whatsapp_number || XDRIVE_WA).replace(/\D/g, '');
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  const condLabel = { used:'Used', recon:'Recon', new:'New' }[car.condition] || car.condition;
  const condStyle = car.condition === 'recon'
    ? { background:'rgba(139,92,246,0.1)', color:'#7c3aed', border:'1px solid rgba(139,92,246,0.22)' }
    : car.condition === 'new'
    ? { background:'rgba(5,150,105,0.09)', color:'#059669', border:'1px solid rgba(5,150,105,0.22)' }
    : { background:'rgba(0,0,0,0.05)', color:'#374151', border:'1px solid rgba(0,0,0,0.1)' };

  const specs = [
    { label:'Mileage', value: mileage ? Number(mileage).toLocaleString('en-MY')+' km' : '—' },
    { label:'Year',    value: year || '—' },
    { label:'Fuel',    value: fuelType || '—' },
    { label:'Gearbox', value: normalTx || '—' },
  ];

  return (
    <div
      onClick={() => {
        if (isSold || !(car.slug || car.id)) return;
        trackEvent(supabase, 'card_click', { car_id:car.id, car_name:title, dealer_id:car.dealer_id||null, metadata:{ source:'carousel_card' } });
        navigate('/showroom/' + (car.slug || car.id));
      }}
      style={{
        background:'#ffffff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'14px',
        overflow:'hidden', cursor: isSold ? 'default' : 'pointer',
        fontFamily:"'Outfit',sans-serif", display:'flex', flexDirection:'column',
        transition:'box-shadow 0.2s, transform 0.15s',
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.13)'; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform='translateY(0)'; }}
    >
      {/* Image */}
      <div style={{ height:'168px', background:'#f3f4f6', position:'relative', overflow:'hidden', flexShrink:0 }}>
        {image ? (
          <>
            {!imgLoaded && (
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,#e8e6e0 25%,#f0eeea 50%,#e8e6e0 75%)', backgroundSize:'200% 100%', animation:'mp-shimmer 1.5s infinite' }} />
            )}
            <img
              src={image} alt={title} loading="lazy"
              onError={() => setImgError(true)}
              onLoad={() => setImgLoaded(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover', opacity: imgLoaded ? 1 : 0, transition:'opacity 0.3s', filter: isSold ? 'grayscale(60%)' : 'none' }}
            />
          </>
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Car size={32} color="#9ca3af" />
          </div>
        )}
        {isSold && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.38)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ background:'#dc2626', color:'#fff', fontSize:'12px', fontWeight:'800', padding:'4px 14px', borderRadius:'20px', letterSpacing:'0.06em' }}>SOLD</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding:'12px 14px 14px', flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
        {/* Brand + model */}
        <div>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'2px' }}>{brand}</div>
          <div style={{ fontSize:'14px', fontWeight:'700', color:'#111827', lineHeight:'1.25', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {year} {model}
          </div>
        </div>

        {/* Price */}
        <div style={{ fontSize:'19px', fontWeight:'800', color:'#111827', letterSpacing:'-0.025em', lineHeight:1 }}>
          {price ? 'RM '+price.toLocaleString('en-MY') : 'P.O.R'}
        </div>

        {/* 2×2 spec grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px' }}>
          {specs.map(({ label, value }) => (
            <div key={label} style={{ background:'rgba(0,0,0,0.04)', borderRadius:'8px', padding:'5px 8px' }}>
              <div style={{ fontSize:'9px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'1px' }}>{label}</div>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Bottom row: condition + WA */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:'2px' }}>
          <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', ...condStyle }}>
            {condLabel || 'Used'}
          </span>
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display:'flex', alignItems:'center', gap:'5px',
              background:'#25D366', color:'#ffffff',
              fontSize:'11px', fontWeight:'700',
              padding:'5px 12px', borderRadius:'20px',
              textDecoration:'none', letterSpacing:'0.02em',
            }}
          >
            <MessageCircle size={11} />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CarCardMarket);
