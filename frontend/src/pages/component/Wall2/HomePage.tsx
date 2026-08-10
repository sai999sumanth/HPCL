import React from 'react';
import { useNavigate } from 'react-router-dom';

// Import images
import infrastructureImg from '../../assets/hpcl/infraa.jpeg';
import operationsImg from '../../assets/hpcl/ops.jpg';
import performanceImg from '../../assets/hpcl/infraa.jpeg';
import governanceImg from '../../assets/hpcl/ops.jpg';
import inventoryImg from '../../assets/hpcl/infraa.jpeg';
import customerImg from '../../assets/hpcl/ops.jpg';

const menuItems = [
  { title: 'Infrastructure', image: infrastructureImg, route: '/infrastructure' },
  { title: 'Operations', image: operationsImg, route: '/operations' }, // TODO: route: '/operations'
  { title: 'Performance', image: performanceImg, route: '/performance' },
  { title: 'Governance', image: governanceImg, route: '/governance' },
  { title: 'Inventory', image: inventoryImg, route: '/inventory' },
  { title: 'Customer', image: customerImg, route: '/customer' }
];

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {menuItems.map((item, index) => (
          <div
            key={index}
            onClick={() => navigate(item.route)}
            className="relative group rounded-lg overflow-hidden h-[280px] cursor-pointer transform transition-all duration-300 hover:scale-105"
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
            
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
              </div>
              
              <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg w-fit">
  
   
              </div>
              
              <div className="absolute bottom-4 right-4">
                <button className="bg-black/40 hover:bg-black/60 text-white px-4 py-2 rounded-md transition-colors">
                  
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
