import { images } from "./images";
import type { Residence } from "./types";

export const residencesSection = {
  eyebrow: "Residences",
  headline: "Three ways to live with the view.",
  intro:
    "One, two and three bedrooms, each planned around a terrace and the water beyond.",
  priceLabel: "From",
  viewLabel: "View Residence",
  detail: {
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    area: "Interior area",
    price: "Starting price",
    highlights: "In this residence",
    floorPlan: "Floor plan",
    planNote: "Indicative plan. Layouts and dimensions vary by floor.",
    cta: "Request a viewing",
  },
} as const;

export const residences: Residence[] = [
  {
    id: "one-bedroom",
    name: "1 Bedroom",
    bedrooms: 1,
    bathrooms: 1,
    area: { min: 75, max: 92 },
    priceFrom: 320_000,
    summary: "One generous room for living, open to the terrace.",
    description:
      "The plan is organised around a single living space that runs the full width of the residence. Sliding glazing opens it to a terrace deep enough to furnish, so the room extends outdoors for most of the year. The bedroom sits behind, away from the street.",
    highlights: [
      "Full-width glazing to the terrace",
      "Oak-fronted kitchen with stone worktop",
      "Bedroom with fitted wardrobes",
    ],
    image: images.oneBedroom,
    // The view is at the bottom of every plan; the entrance side is at the top.
    floorPlan: {
      width: 480,
      height: 380,
      summary:
        "Indicative plan of the 1 Bedroom residence: a living room and kitchen across the full width, opening onto a terrace, with the bedroom, bathroom and entrance behind.",
      walls: "M0 0H480V310H0Z M0 140H480 M210 0V140 M320 0V140",
      glazing: "M8 304H472",
      terraces: "M0 310V380H480V310",
      labels: [
        { text: "Bedroom", x: 105, y: 70 },
        { text: "Bath", x: 265, y: 70 },
        { text: "Entrance", x: 400, y: 70 },
        { text: "Kitchen", x: 110, y: 225 },
        { text: "Living", x: 320, y: 225 },
        { text: "Terrace", x: 240, y: 345 },
      ],
    },
  },
  {
    id: "two-bedroom",
    name: "2 Bedroom",
    bedrooms: 2,
    bathrooms: 2,
    area: { min: 110, max: 145 },
    priceFrom: 480_000,
    summary: "Kitchen, dining and living arranged along the view.",
    description:
      "Kitchen, dining and living follow one another along the window wall, each with its own outlook over the water. A travertine island anchors the room. The two bedrooms are placed at opposite ends of the plan, each with its own bathroom.",
    highlights: [
      "Travertine kitchen island",
      "Two bedrooms, each with a bathroom",
      "Terrace along the living space",
    ],
    image: images.twoBedroom,
    floorPlan: {
      width: 480,
      height: 350,
      summary:
        "Indicative plan of the 2 Bedroom residence: kitchen, dining and living in a row along the window wall and its terrace, with a bedroom and bathroom at each end.",
      walls: "M0 0H480V280H0Z M0 100H105 M375 100H480 M105 0V280 M375 0V280 M105 100H175 M305 100H375",
      glazing: "M113 274H367 M8 274H97 M383 274H472",
      terraces: "M105 280V350H375V280",
      labels: [
        { text: "Bath", x: 52, y: 50 },
        { text: "Entrance", x: 240, y: 50 },
        { text: "Bath", x: 428, y: 50 },
        { text: "Bedroom", x: 52, y: 190 },
        { text: "Kitchen", x: 150, y: 190 },
        { text: "Dining", x: 240, y: 190 },
        { text: "Living", x: 330, y: 190 },
        { text: "Bedroom", x: 428, y: 190 },
        { text: "Terrace", x: 240, y: 315 },
      ],
    },
  },
  {
    id: "three-bedroom",
    name: "3 Bedroom",
    bedrooms: 3,
    bathrooms: 3,
    area: { min: 165, max: 210 },
    priceFrom: 720_000,
    summary: "Corner residences with daylight from two sides.",
    description:
      "The three-bedroom residences occupy the corners of the building. Living and dining share a room glazed on two sides, with daylight from morning until evening, and a wraparound terrace follows it outside. The principal bedroom has a dressing room and a terrace of its own.",
    highlights: [
      "Glazing on two sides of the living room",
      "Wraparound terrace",
      "Principal bedroom with dressing room",
    ],
    image: images.threeBedroom,
    floorPlan: {
      width: 480,
      height: 420,
      summary:
        "Indicative plan of the 3 Bedroom residence: a corner living and dining room glazed on two sides with a wraparound terrace, a kitchen, two bedrooms with bathrooms, and a principal bedroom with a dressing room, bathroom and its own terrace.",
      walls:
        "M0 0H420V360H0Z M0 150H420 M180 0V360 M110 0V150 M110 75H180 M300 0V150 M300 70H420 " +
        "M0 215H180 M100 150V215",
      glazing: "M188 354H414V158 M8 354H172",
      terraces: "M180 360V420H480V150H420 M0 360V420H160V360",
      labels: [
        { text: "Bedroom", x: 55, y: 75 },
        { text: "Bath", x: 145, y: 38 },
        { text: "Bath", x: 145, y: 113 },
        { text: "Bedroom", x: 240, y: 75 },
        { text: "Entrance", x: 360, y: 35 },
        { text: "Kitchen", x: 360, y: 110 },
        { text: "Dressing", x: 50, y: 183 },
        { text: "Bath", x: 140, y: 183 },
        { text: "Principal", x: 90, y: 288 },
        { text: "Living", x: 300, y: 225 },
        { text: "Dining", x: 300, y: 300 },
        { text: "Terrace", x: 80, y: 392 },
        { text: "Terrace", x: 330, y: 392 },
      ],
    },
  },
];
