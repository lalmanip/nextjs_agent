"use client";
import { useState } from "react";

interface Package {
  id: string;
  title: string;
  destination: string;
  duration: string;
  price: number;
  originalPrice: number;
  image: string;
  rating: number;
  reviews: number;
  highlights: string[];
  description: string;
}

const packages: Package[] = [
  {
    id: "1",
    title: "Magical Dubai Experience",
    destination: "Dubai, UAE",
    duration: "4 Days / 3 Nights",
    price: 24999,
    originalPrice: 35000,
    image:
      "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&amp;q=80?w=500&h=300&fit=crop",
    rating: 4.8,
    reviews: 245,
    highlights: ["Burj Khalifa", "Desert Safari", "Shopping Mall", "Beach"],
    description:
      "Experience the luxury and adventure of Dubai with visits to iconic landmarks and desert adventures",
  },
  {
    id: "2",
    title: "Bali Paradise Getaway",
    destination: "Bali, Indonesia",
    duration: "5 Days / 4 Nights",
    price: 19999,
    originalPrice: 28000,
    image:
      "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&amp;q=80&h=500&fit=crop",
    rating: 4.9,
    reviews: 312,
    highlights: ["Temples", "Beaches", "Rice Terraces", "Spa"],
    description:
      "Discover the tropical beauty of Bali with pristine beaches, ancient temples, and world-class resorts.",
  },
  {
    id: "3",
    title: "Swiss Alps Adventure",
    destination: "Switzerland",
    duration: "6 Days / 5 Nights",
    price: 54999,
    originalPrice: 75000,
    image:
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=500&h=300&fit=crop",
    rating: 4.7,
    reviews: 189,
    highlights: [
      "Mountain Hiking",
      "Scenic Trains",
      "Alpine Villages",
      "Lakes",
    ],
    description:
      "Experience the breathtaking beauty of the Swiss Alps with mountain adventures and scenic landscapes.",
  },
  {
    id: "4",
    title: "Paris Romance Tour",
    destination: "Paris, France",
    duration: "4 Days / 3 Nights",
    price: 34999,
    originalPrice: 48000,
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=300&fit=crop",
    rating: 4.9,
    reviews: 428,
    highlights: ["Eiffel Tower", "Louvre Museum", "Seine Cruise", "Cafes"],
    description:
      "Fall in love with the City of Light - explore iconic monuments, museums, and charming cafes.",
  },
  {
    id: "5",
    title: "Maldives Luxury Escape",
    destination: "Maldives",
    duration: "5 Days / 4 Nights",
    price: 79999,
    originalPrice: 110000,
    image:
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&h=300&fit=crop",
    rating: 5.0,
    reviews: 356,
    highlights: ["Overwater Bungalows", "Snorkeling", "Spa", "Water Sports"],
    description:
      "Indulge in luxury at the Maldives with overwater bungalows, pristine beaches, and crystal-clear waters.",
  },
  {
    id: "6",
    title: "Tokyo Cultural Journey",
    destination: "Tokyo, Japan",
    duration: "5 Days / 4 Nights",
    price: 44999,
    originalPrice: 62000,
    image:
      "https://images.unsplash.com/photo-1540959375944-7049f642e9a0?w=500&h=300&fit=crop",
    rating: 4.8,
    reviews: 267,
    highlights: ["Temples", "Modern City", "Cuisine", "Shopping"],
    description:
      "Blend ancient traditions with modern technology in vibrant Tokyo with temples, gardens, and bustling streets.",
  },
  {
    id: "7",
    title: "New York City Explorer",
    destination: "New York, USA",
    duration: "4 Days / 3 Nights",
    price: 39999,
    originalPrice: 55000,
    image:
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=500&h=300&fit=crop",
    rating: 4.7,
    reviews: 534,
    highlights: ["Times Square", "Statue of Liberty", "Broadway", "Museums"],
    description:
      "Experience the energy of NYC with iconic landmarks, world-class museums, and Broadway shows.",
  },
  {
    id: "8",
    title: "Thailand Beach Bliss",
    destination: "Thailand",
    duration: "5 Days / 4 Nights",
    price: 22999,
    originalPrice: 32000,
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop",
    rating: 4.8,
    reviews: 401,
    highlights: ["Beaches", "Islands", "Temples", "Night Markets"],
    description:
      "Explore Thailand's stunning beaches, vibrant culture, and delicious cuisine in this tropical paradise.",
  },
  {
    id: "9",
    title: "Himalayan Escape",
    destination: "Himalayas, India",
    duration: "6 Days / 5 Nights",
    price: 18999,
    originalPrice: 27000,
    image: "/Himalaya.jpg",
    rating: 4.9,
    reviews: 312,
    highlights: ["Snow Peaks", "Trekking", "Monasteries", "Scenic Views"],
    description:
      "Breathe in the crisp mountain air and explore the majestic Himalayan peaks, serene valleys, and ancient monasteries.",
  },
  {
    id: "10",
    title: "Sadguru Heritage Trail",
    destination: "Coimbatore, India",
    duration: "3 Days / 2 Nights",
    price: 9999,
    originalPrice: 14500,
    image: "/sadguru_heritage.jpg",
    rating: 4.8,
    reviews: 198,
    highlights: ["Isha Yoga Center", "Dhyanalinga", "Nature Trails", "Meditation"],
    description:
      "A soulful journey to the Isha Yoga Center, explore the Dhyanalinga and rejuvenate with meditation retreats.",
  },
  {
    id: "11",
    title: "Swarveda Mahamandir",
    destination: "Uttar Pradesh, India",
    duration: "2 Days / 1 Night",
    price: 6999,
    originalPrice: 10000,
    image: "/SwarvedMahaMandir.jpg",
    rating: 4.7,
    reviews: 143,
    highlights: ["Mahamandir", "Spiritual Retreat", "Architecture", "Peace"],
    description:
      "Visit the magnificent Swarveda Mahamandir, one of the largest meditation temples in the world.",
  },
  {
    id: "12",
    title: "Tadoba Tiger Safari",
    destination: "Maharashtra, India",
    duration: "3 Days / 2 Nights",
    price: 14999,
    originalPrice: 21000,
    image: "/tiger-safari-in-tadoba-1.webp",
    rating: 4.9,
    reviews: 267,
    highlights: ["Tiger Sightings", "Jungle Safari", "Wildlife", "Forest Camps"],
    description:
      "Embark on a thrilling jungle safari in Tadoba Andhari Tiger Reserve — home to Bengal tigers and exotic wildlife.",
  },
  {
    id: "13",
    title: "Varanasi — City of Light",
    destination: "Varanasi, India",
    duration: "3 Days / 2 Nights",
    price: 8999,
    originalPrice: 13000,
    image: "/varanasi.jpg",
    rating: 4.8,
    reviews: 489,
    highlights: ["Ganga Aarti", "Ghats", "Temples", "Boat Ride"],
    description:
      "Witness the mesmerising Ganga Aarti, explore ancient ghats, and soak in the spiritual energy of Varanasi.",
  },
  {
    id: "14",
    title: "Varanasi Spiritual Sunrise",
    destination: "Varanasi, India",
    duration: "2 Days / 1 Night",
    price: 5999,
    originalPrice: 8500,
    image: "/varanasi2.jpg",
    rating: 4.7,
    reviews: 321,
    highlights: ["Sunrise Boat Ride", "Silk Weaving", "Street Food", "Old City Walk"],
    description:
      "Experience Varanasi at dawn — a golden sunrise boat ride on the Ganges, silk bazaars and the old city maze.",
  },
];

interface HolidaysProps {
  onBack?: () => void;
}

export default function Holidays({ onBack }: HolidaysProps) {
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [filterDestination, setFilterDestination] = useState("all");
  const [sortBy, setSortBy] = useState("popular");

  const destinations = [
    "all",
    ...Array.from(new Set(packages.map((p) => p.destination))),
  ];

  const filteredPackages = packages.filter(
    (pkg) =>
      filterDestination === "all" || pkg.destination === filterDestination,
  );

  const sortedPackages = [...filteredPackages].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "rating":
        return b.rating - a.rating;
      default:
        return 0;
    }
  });

  const discount = (pkg: Package) => {
    return Math.round(
      ((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100,
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-orange-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={onBack}
            className="mb-4 text-white hover:text-gray-200 flex items-center"
          >
            ← Back to Home
          </button>
          <h1 className="text-4xl font-bold mb-2">Holiday Packages</h1>
          <p className="text-lg opacity-90">
            Discover amazing travel packages to your dream destinations
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Sort */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination
              </label>
              <select
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {destinations.map((dest) => (
                  <option key={dest} value={dest}>
                    {dest === "all" ? "All Destinations" : dest}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Results
              </label>
              <div className="flex items-center h-10 bg-gray-100 rounded-lg px-3">
                <span className="text-gray-700">
                  {sortedPackages.length} packages found
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {sortedPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden cursor-pointer"
              onClick={() => setSelectedPackage(pkg)}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden bg-gray-200">
                <img
                  src={pkg.image}
                  alt={pkg.title}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                />
                {discount(pkg) > 0 && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {discount(pkg)}% OFF
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {pkg.title}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{pkg.destination}</p>
                <p className="text-xs text-gray-500 mb-3">{pkg.duration}</p>

                {/* Rating */}
                <div className="flex items-center mb-3">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < Math.floor(pkg.rating)
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-600 ml-2">
                    ({pkg.reviews})
                  </span>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      ₹{pkg.price.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 line-through">
                      ₹{pkg.originalPrice.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">per person</p>
                </div>

                {/* Highlights */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {pkg.highlights.slice(0, 2).map((highlight, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                      >
                        {highlight}
                      </span>
                    ))}
                    {pkg.highlights.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        +{pkg.highlights.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Button */}
                <button className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors font-medium">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Package Details Modal */}
        {selectedPackage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="relative h-64 overflow-hidden">
                <img
                  src={selectedPackage.image}
                  alt={selectedPackage.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <h2 className="text-3xl font-bold mb-2">
                  {selectedPackage.title}
                </h2>
                <p className="text-gray-600 mb-4">
                  {selectedPackage.destination}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-lg font-semibold">
                      {selectedPackage.duration}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Rating</p>
                    <div className="flex items-center">
                      <span className="text-lg font-semibold">
                        {selectedPackage.rating}
                      </span>
                      <span className="text-yellow-400 ml-2">★</span>
                      <span className="text-sm text-gray-600 ml-2">
                        ({selectedPackage.reviews} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">
                  {selectedPackage.description}
                </p>

                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Highlights</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPackage.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-center">
                        <span className="text-primary mr-2">✓</span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Starting from</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-primary">
                          ₹{selectedPackage.price.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500 line-through">
                          ₹{selectedPackage.originalPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">per person</p>
                    </div>
                    <button className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary-dark font-semibold">
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
