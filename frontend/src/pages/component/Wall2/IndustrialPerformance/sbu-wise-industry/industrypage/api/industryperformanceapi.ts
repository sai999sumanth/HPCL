// import { faker } from '@faker-js/faker';

// // Mock data generators
// const generateIndustryData = () => ({
//   "2023-2024": {
//     MPSU: faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }),
//     PSU: faker.number.float({ min: 200, max: 1500, fractionDigits: 2 }),
//     "PSU+PVT": faker.number.float({ min: 300, max: 2000, fractionDigits: 2 })
//   },
//   "growth_percentage": {
//     MPSU: faker.number.float({ min: -10, max: 25, fractionDigits: 1 }),
//     PSU: faker.number.float({ min: -5, max: 30, fractionDigits: 1 }),
//     "PSU+PVT": faker.number.float({ min: 0, max: 35, fractionDigits: 1 })
//   }
// });

// const generateAreaChartData = () => {
//   const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
//   return months.map(month => ({
//     month,
//     value: faker.number.float({ min: 50, max: 200, fractionDigits: 2 }),
//     growth: faker.number.float({ min: -10, max: 30, fractionDigits: 1 })
//   }));
// };

// const generateHeatmapData = () => {
//   const categories = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'];
//   const regions = ['North', 'South', 'East', 'West', 'Central'];
  
//   return categories.map(category => ({
//     category,
//     regions: regions.map(region => ({
//       region,
//       value: faker.number.float({ min: 10, max: 100, fractionDigits: 1 }),
//       performance: faker.helpers.arrayElement(['High', 'Medium', 'Low'])
//     }))
//   }));
// };

// export const fetchIndustryData = async () => {
//   // Simulate API delay
//   await new Promise(resolve => setTimeout(resolve, 500));
//   return generateIndustryData();
// };

// export const fetchIndustryAreaChartData = async (ytm: boolean = true) => {
//   await new Promise(resolve => setTimeout(resolve, 300));
//   return generateAreaChartData();
// };

// export const fetchSbuLevelHeatmapData = async () => {
//   await new Promise(resolve => setTimeout(resolve, 400));
//   return generateHeatmapData();
// };

// export const fetchProductLevelHeatmapData = async () => {
//   await new Promise(resolve => setTimeout(resolve, 350));
//   return generateHeatmapData();
// };
