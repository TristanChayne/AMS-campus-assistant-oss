import React from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><MotionConfig reducedMotion="user" transition={{duration:.22,ease:[.22,1,.36,1]}}><App/></MotionConfig></React.StrictMode>);
