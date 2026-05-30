export default function Services() {
  const services = [
    {
      title: "Flight Booking",
      description: "Find the best deals on domestic and international flights",
      icon: "✈️",
    },
    {
      title: "Hotel Reservations",
      description: "Book luxury hotels and budget accommodations worldwide",
      icon: "🏨",
    },
    {
      title: "Cruise Packages",
      description: "Explore the seas with our exclusive cruise deals",
      icon: "🚢",
    },
    {
      title: "Holiday Packages",
      description: "Complete vacation packages with flights, hotels, and activities",
      icon: "🏖️",
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Services</h2>
          <p className="text-lg text-gray-600">Everything you need for your perfect trip</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">{service.title}</h3>
              <p className="text-gray-600">{service.description}</p>
              <button className="mt-4 text-primary font-medium hover:text-primary-dark">
                Learn More →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}