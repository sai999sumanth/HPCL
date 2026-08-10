export const initialNodes = [
  {
    id: "lrca",
    type: "basic",
    data: {
      name: "LRCA",
      status: "online",
      showBottomEdge: true,
    },
    position: { x: 0, y: -100 },
  },
  {
    id: "lrcb",
    type: "basic",
    data: {
      name: "LRCB",
      status: "online",
      showBottomEdge: true,
    },
    position: { x: 425, y: -100 },
  },
  {
    id: "safety-group",
    type: "customGroup",
    data: {
      name: "Safety",
      items: [],
      showTopEdge: true,
      showBottomEdge: true,
    },
    position: { x: -100, y: 200 },
  },
  {
    id: "gantry_bcu",
    type: "advanced",
    data: {
      name: "Gantry BCU",
      showTopEdge: true,
    },
    position: { x: 100, y: 200 },
  },
  {
    id: "mfm",
    type: "advanced",
    data: {
      name: "MFM",
      showTopEdge: true,
    },
    position: { x: 300, y: 200 },
  },
  {
    id: "process-group",
    type: "customGroup",
    data: {
      name: "Process",
      items: [],
      showRightEdge: true,
      showTopEdge: true,
    },
    position: { x: 470, y: 200 },
  },

  {
    id: "primary_radar",
    type: "advanced",
    data: {
      name: "Primary Radar",
      showBottomEdge: true,
    },
    position: { x: 950, y: 0 },
  },
  {
    id: "mov",
    type: "advanced",
    data: {
      name: "MOV",
      showTopEdge: true,
    },
    position: { x: 775, y: 500 },
  },
  {
    id: "pumps",
    type: "advanced",
    data: {
      name: "Pumps",
      showTopEdge: true,
    },
    position: { x: 950, y: 500 },
  },
  {
    id: "barrier_gate",
    type: "advanced",
    data: {
      name: "Barrier Gate",
      showBottomEdge: true,
    },
    position: { x: 775, y: 0 },
  },
  {
    id: "rosov",
    type: "advanced",
    data: {
      name: "Rosov",
      showBottomEdge: true,
    },
    position: { x: -425, y: 0 },
  },
  {
    id: "vft",
    type: "advanced",
    data: {
      name: "VFT",
      showBottomEdge: true,
    },
    position: { x: -250, y: 0 },
  },
  {
    id: "secondary_radar",
    type: "advanced",
    data: {
      name: "Secondary Radar",
      showTopEdge: true,
    },
    position: { x: -175, y: 500 },
  },
  {
    id: "pt_hydrant",
    type: "advanced",
    data: {
      name: "PT Hydrant",
      showTopEdge: true,
    },
    position: { x: -525, y: 500 },
  },
  {
    id: "hooter",
    type: "advanced",
    data: {
      name: "Hooter",
      showBottomEdge: true,
    },
    position: { x: -600, y: 0 },
  },
  {
    id: "esd",
    type: "advanced",
    data: {
      name: "ESD",
      showTopEdge: true,
    },
    position: { x: -700, y: 500 },
  },
  {
    id: "fire_engine",
    type: "advanced",
    data: {
      name: "Fire Engine",
      showTopEdge: true,
    },
    position: { x: 25, y: 500 },
  },
  {
    id: "hcd",
    type: "advanced",
    data: {
      name: "HCD",
      showTopEdge: true,
    },
    position: { x: 200, y: 500 },
  },
  {
    id: "dyke",
    type: "advanced",
    data: {
      name: "Dyke",
      showTopEdge: true,
    },
    position: { x: 380, y: 500 },
  },
  {
    id: "jockey_pump",
    type: "advanced",
    data: {
      name: "Jockey Pump",
      showTopEdge: true,
    },
    position: { x: -350, y: 500 },
  },
  {
    id: "air_compressor",
    type: "advanced",
    data: {
      name: "Air Compressor",
      showTopEdge: true,
    },
    position: { x: 575, y: 500 },
  },
  {
    id: "ups",
    type: "basic",
    data: { name: "UPS", showBottomEdge: true },
    position: { x: 650, y: -100 },
  },
];
