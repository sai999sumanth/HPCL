import { ChartData } from '@/pages/custom-dashboard/types/charts';

export const hierarchicalData: Record<string, ChartData[]> = {
  // revenue: [
  //   {
  //     name: 'Jan',
  //     value: 400,
  //     children: [
  //       { name: 'Week 1', value: 100, children: [
  //         { name: 'Monday', value: 20 },
  //         { name: 'Tuesday', value: 25 },
  //         { name: 'Wednesday', value: 15 },
  //         { name: 'Thursday', value: 20 },
  //         { name: 'Friday', value: 20 },
  //       ]},
  //       { name: 'Week 2', value: 90, children: [
  //         { name: 'Monday', value: 15 },
  //         { name: 'Tuesday', value: 20 },
  //         { name: 'Wednesday', value: 25 },
  //         { name: 'Thursday', value: 15 },
  //         { name: 'Friday', value: 15 },
  //       ]},
  //       { name: 'Week 3', value: 110 },
  //       { name: 'Week 4', value: 100 },
  //     ],
  //   },
  //   {
  //     name: 'Feb',
  //     value: 300,
  //     children: [
  //       { name: 'Week 1', value: 80 },
  //       { name: 'Week 2', value: 70 },
  //       { name: 'Week 3', value: 75 },
  //       { name: 'Week 4', value: 75 },
  //     ],
  //   },
  //   {
  //     name: 'Mar',
  //     value: 600,
  //     children: [
  //       { name: 'Week 1', value: 150 },
  //       { name: 'Week 2', value: 140 },
  //       { name: 'Week 3', value: 160 },
  //       { name: 'Week 4', value: 150 },
  //     ],
  //   },
  //   {
  //     name: 'Apr',
  //     value: 800,
  //     children: [
  //       { name: 'Week 1', value: 200 },
  //       { name: 'Week 2', value: 210 },
  //       { name: 'Week 3', value: 190 },
  //       { name: 'Week 4', value: 200 },
  //     ],
  //   },
  //   {
  //     name: 'May',
  //     value: 500,
  //     children: [
  //       { name: 'Week 1', value: 120 },
  //       { name: 'Week 2', value: 130 },
  //       { name: 'Week 3', value: 125 },
  //       { name: 'Week 4', value: 125 },
  //     ],
  //   },
  // ],
  // revenue: [
  //   {
  //     name: 'NWZ',
  //     value: 400,
  //     children: [
  //       { name: 'Dharmapuri', value: 100, children: [
  //         { name: '19KG', value: 75 },
  //         { name: '14.2KG', value: 25 }
  //       ]},
  //       { name: 'Anantpur', value: 90, children: [
  //         { name: '19KG', value: 30 },
  //         { name: '14.2KG', value: 60 }
  //       ]},
  //       { name: 'Hubli', value: 110 },
  //       { name: 'Usar', value: 100 },
  //     ],
  //   },
  //   {
  //     name: 'SZ',
  //     value: 300,
  //     children: [
  //       { name: 'Manglore', value: 80 },
  //       { name: 'Mysore', value: 70 },
  //       { name: 'Barhi', value: 75 },
  //       { name: 'Banglore', value: 75 },
  //     ],
  //   },
  //   {
  //     name: 'EZ',
  //     value: 600,
  //     children: [
  //       { name: 'Gummidipundi', value: 150 },
  //       { name: 'Muhul', value: 140 },
  //       { name: 'Nashik', value: 160 },
  //       { name: 'Loni', value: 150 },
  //     ],
  //   },
  //   {
  //     name: 'SWZ',
  //     value: 800,
  //     children: [
  //       { name: 'Ghorakhpur', value: 200 },
  //       { name: 'Purnea', value: 210 },
  //       { name: 'Madurai', value: 190 },
  //       { name: 'Pindwara', value: 200 },
  //     ],
  //   },    
  // ],

  'revenue': [{ 'name': 'NZ', 'value': 1529.2333333333333, 'children': [{ 'name': 'sitarganj', 'value': 1529.2333333333333 }] }, { 'name': 'WZ', 'value': 782.3666666666667, 'children': [{ 'name': 'usar', 'value': 782.3666666666667 }] }, { 'name': 'EZ', 'value': 1372.5333333333333, 'children': [{ 'name': 'barhi', 'value': 1372.5333333333333 }] }, { 'name': 'SZ', 'value': 5173.866666666667, 'children': [{ 'name': 'gummidipoondi', 'value': 1261.75 }, { 'name': 'hubli', 'value': 1123.3333333333333 }, { 'name': 'mysore', 'value': 1333.7 }, { 'name': 'madurai', 'value': 1455.0833333333333 }] }],
  users: [
    {
      name: 'Mon',
      value: 100,
      children: [
        { name: 'Morning', value: 40 },
        { name: 'Afternoon', value: 35 },
        { name: 'Evening', value: 25 },
      ],
    },
    {
      name: 'Tue',
      value: 200,
      children: [
        { name: 'Morning', value: 80 },
        { name: 'Afternoon', value: 70 },
        { name: 'Evening', value: 50 },
      ],
    },
    {
      name: 'Wed',
      value: 150,
      children: [
        { name: 'Morning', value: 60 },
        { name: 'Afternoon', value: 50 },
        { name: 'Evening', value: 40 },
      ],
    },
    {
      name: 'Thu',
      value: 300,
      children: [
        { name: 'Morning', value: 120 },
        { name: 'Afternoon', value: 100 },
        { name: 'Evening', value: 80 },
      ],
    },
    {
      name: 'Fri',
      value: 250,
      children: [
        { name: 'Morning', value: 100 },
        { name: 'Afternoon', value: 90 },
        { name: 'Evening', value: 60 },
      ],
    },
  ],
  distribution: [
    {
      name: 'Product A',
      value: 400,
      children: [
        { name: 'Region 1', value: 100 },
        { name: 'Region 2', value: 150 },
        { name: 'Region 3', value: 150 },
      ],
    },
    {
      name: 'Product B',
      value: 300,
      children: [
        { name: 'Region 1', value: 80 },
        { name: 'Region 2', value: 120 },
        { name: 'Region 3', value: 100 },
      ],
    },
    {
      name: 'Product C',
      value: 300,
      children: [
        { name: 'Region 1', value: 90 },
        { name: 'Region 2', value: 110 },
        { name: 'Region 3', value: 100 },
      ],
    },
    {
      name: 'Product D',
      value: 200,
      children: [
        { name: 'Region 1', value: 60 },
        { name: 'Region 2', value: 70 },
        { name: 'Region 3', value: 70 },
      ],
    },
  ],
};