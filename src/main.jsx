import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <Suspense fallback={null}>
        <App />
        <Toaster />
    </Suspense>
);
