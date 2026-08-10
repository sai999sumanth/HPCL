// RetailOutletIcon.jsx
const RetailOutletIcon = () => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M30 20 h40 v60 h-40 Z
           M45 35 h10 v10 h-10 Z
           M35 80 h30
           M20 80 h60"
        stroke="currentColor"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="30" r="3" fill="currentColor" />
    </svg>
  );
  
  // RetailTerminalIcon.jsx
  const RetailTerminalIcon = () => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M30 20 h40 v60 h-40 Z
           M30 30 h40
           M30 40 h40
           M30 50 h40"
        stroke="currentColor"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="65" r="3" fill="currentColor" />
    </svg>
  );
  
  // LPGIcon.jsx
  const LPGIcon = () => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M40 30 h20 v10 
           q0 30 -10 40
           q-10 10 -20 0
           q-10 -10 -10 -40
           v-10 h20
           M35 25 h30"
        stroke="currentColor"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="45" r="3" fill="currentColor" />
    </svg>
  );
  
  export { RetailOutletIcon, RetailTerminalIcon, LPGIcon };