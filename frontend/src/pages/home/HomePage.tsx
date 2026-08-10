// import React from 'react';
// import { useNavigate } from 'react-router-dom';

// // Import images
// import infrastructureImg from '../../assets/hpcl/infraa.jpeg';
// import operationsImg from '../../assets/hpcl/ops.jpg';
// import performanceImg from '../../assets/hpcl/infraa.jpeg';
// import governanceImg from '../../assets/hpcl/ops.jpg';
// import inventoryImg from '../../assets/hpcl/infraa.jpeg';
// import customerImg from '../../assets/hpcl/ops.jpg';

// const menuItems = [
//   { title: 'Infrastructure', image: infrastructureImg, route: '/infrastructure' },
//   { title: 'Operations', image: operationsImg, route: '/operations' }, // TODO: route: '/operations'
//   { title: 'Performance', image: performanceImg, route: '/performance' },
//   { title: 'Governance', image: governanceImg, route: '/governance' },
//   { title: 'Inventory', image: inventoryImg, route: '/inventory' },
//   { title: 'Customer', image: customerImg, route: '/customer' }
// ];

// const HomePage = () => {
//   const navigate = useNavigate();

//   return (
//     <div className="min-h-screen p-8">
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
//         {menuItems.map((item, index) => (
//           <div
//             key={index}
//             onClick={() => navigate(item.route)}
//             className="relative group rounded-lg overflow-hidden h-[280px] cursor-pointer transform transition-all duration-300 hover:scale-105"
//           >
//             <img
//               src={item.image}
//               alt={item.title}
//               className="w-full h-full object-cover"
//             />
//             <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
            
//             <div className="absolute inset-0 p-6 flex flex-col justify-between">
//               <div>
//                 <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
//               </div>
              
//               <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg w-fit">
  
   
//               </div>
              
//               <div className="absolute bottom-4 right-4">
//                 <button className="bg-black/40 hover:bg-black/60 text-white px-4 py-2 rounded-md transition-colors">
                  
//                 </button>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default HomePage;




// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import { IconKeyframes } from '@tabler/icons-react';

// // Import images
import infrastructureImg from '../../assets/hpcl/infraa.jpeg';
import operationsImg from '../../assets/hpcl/ops.jpg';
import performanceImg from '../../assets/hpcl/infraa.jpeg';
import governanceImg from '../../assets/hpcl/ops.jpg';
import inventoryImg from '../../assets/hpcl/infraa.jpeg';
import customerImg from '../../assets/hpcl/ops.jpg';

// // Define icons
// import { IconBuilding, IconChartBar, IconClipboard, IconFile, IconUser } from '@tabler/icons-react';

// // Define icon mapping
// const iconMap = {
//   'Infrastructure': IconBuilding,
//   'Operations': IconChartBar,
//   'Performance': IconClipboard,
//   'Governance': IconFile,
//   'Inventory': IconClipboard,
//   'Customer': IconUser,
// };

// const menuItems = [
//   { title: 'Infrastructure', color: 'blue', route: '/infrastructure' },
//   { title: 'Operations', color: 'red', route: '/operations' }, // TODO: route: '/operations'
//   { title: 'Performance', color: 'green', route: '/performance' },
//   { title: 'Governance', color: 'purple', route: '/governance' },
//   { title: 'Inventory', color: 'brown', route: '/inventory' },
//   { title: 'Customer', color: 'orange', route: '/customer' }
// ];

// const HomePage = () => {
//   const navigate = useNavigate();

//   return (
//     <div className="min-h-screen p-3">
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
//         {menuItems.map((item, index) => (
//           <div
//             key={index}
//             onClick={() => navigate(item.route)}
//             className="relative shadow-lg group rounded-lg overflow-hidden h-[150px] cursor-pointer transform transition-all duration-300 hover:scale-105"
//           >
//             <div className="rounded-lg w-80 h-full bg-[#ffffff] text-[#000000]">
//                 <div className="flex flex-row w-full gap-5 justify-center items-center px-7 w-full h-full">
//                     <div className="my-auto text-xl">
//                       {React.createElement(iconMap[item.title], { stroke: 1.5, width: 50, height: 50, color: item.color })}
//                     </div>
//                     <div>
//                         <div className="font-bold text-xl">{item.title}</div>
//                         {/* <div className=" text-sm">You have one new unread message in your inbox.</div> */}
//                     </div>
//                 </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default HomePage;



// Import necessary libraries
// import React from 'react';
// import { Link } from 'react-router-dom'; // Replace with `next/link` if using Next.js

// // Define icon mapping
// const iconMap = {
//   'Infrastructure': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', // Replace with your desired GIFs
//   'Operations': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
//   'Performance': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
//   'Governance': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
//   'Inventory': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
//   'Customer': 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
// };

// // Menu items
// const menuItems = [
//   { title: 'Infrastructure', color: 'blue', route: '/infrastructure' },
//   { title: 'Operations', color: 'red', route: '/operations' },
//   { title: 'Performance', color: 'green', route: '/performance' },
//   { title: 'Governance', color: 'purple', route: '/governance' },
//   { title: 'Inventory', color: 'brown', route: '/inventory' },
//   { title: 'Customer', color: 'orange', route: '/customer' },
// ];

// const Card = ({ title, color, route, gif }) => {
//   return (
//     <Link to={route} className={`block border rounded-lg shadow-md hover:shadow-lg transition-shadow bg-white p-4`} style={{ borderColor: color }}>
//       <div className="flex flex-col items-center">
//         <img src={gif} alt={title} className="w-16 h-16 mb-2 rounded-full" />
//         <h3 className={`text-lg font-semibold text-${color}-600`}>{title}</h3>
//       </div>
//     </Link>
//   );
// };

// const HomePage = () => {
//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-6">
//       {menuItems.map(({ title, color, route }) => (
//         <Card
//           key={title}
//           title={title}
//           color={color}
//           route={route}
//           gif={iconMap[title]}
//         />
//       ))}
//     </div>
//   );
// };

// export default HomePage;



// // Import necessary libraries
import React from 'react';
import { Link } from 'react-router-dom'; // Replace with `next/link` if using Next.js

// Define icon mapping
const iconMap = {
  'Infrastructure': infrastructureImg,
  'Operations': operationsImg,
  'Performance': performanceImg,
  'Governance': governanceImg,
  'Inventory': inventoryImg,
  'Customer': customerImg,
};

// Menu items
const menuItems = [
  // { title: 'Infrastructure', color: 'blue', route: '/infrastructure' },
  { title: 'Operations', color: 'red', route: '/operations' },
  { title: 'Performance', color: 'green', route: '/performance' },
  { title: 'Governance', color: 'purple', route: '/governance' },
  { title: 'Inventory', color: 'brown', route: '/inventory' },
  { title: 'Customer', color: 'orange', route: '/customer' },
];

// const Card = ({ title, color, route, gif }) => {
//   return (
//     <Link to={route} className={`block border shadow-md hover:shadow-lg transition-shadow bg-white p-4 rounded-lg overflow-hidden`}>
//       <div className="flex flex-col items-center">
//         <h3 className={`text-lg font-semibold text-gray-800 mb-2`}>{title}</h3>
//         <img src={gif} alt={title} className="w-full h-40 object-cover mb-2 rounded-lg" />
//       </div>
//     </Link>
//   );
// };

// const Card = ({ title, color, route, gif }) => {
//   return (
//     <Link to={route} className={`block shadow-lg hover:shadow-xl transition-shadow bg-white/30 backdrop-blur-md p-6 rounded-2xl overflow-hidden`}>
//       <div className="flex flex-col items-center">
//         <h3 className={`text-xl font-semibold text-gray-800 mb-4`}>{title}</h3>
//         <img src={gif} alt={title} className="w-full h-48 object-cover rounded-xl" />
//       </div>
//     </Link>
//   );
// };

const Card = ({ title, route, gif, color }) => {
  return (
    <Link to={route} className="block rounded-2xl overflow-hidden">
      <div className="flex flex-col items-center p-4 border bg-white/30 backdrop-blur-md shadow-lg hover:mb-2 transition-shadow rounded-2xl">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <img src={gif} alt={title} className="w-full h-48 object-cover rounded-xl" />
      </div>
    </Link>
  );
};

const HomePage = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {menuItems.map(({ title, color, route }) => (
        <Card
          key={title}
          title={title}
          color={color}
          route={route}
          gif={iconMap[title]}
        />
      ))}
    </div>
  );
};

export default HomePage;
