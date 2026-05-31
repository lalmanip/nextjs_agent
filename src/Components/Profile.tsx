"use client";
import { useState, useEffect } from "react";
import { passengerAPI, PassengerData } from "@/lib/api";
import { formatUserDate } from "@/lib/dateLocale";
import { useDateLocale } from "@/Components/DateLocaleProvider";

interface ProfileProps {
  user: any;
  onBack: () => void;
}

interface Passenger {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  passportNationality: string;
  passportNumber: string;
  passportExpiryDay: string;
  passportExpiryMonth: string;
  passportExpiryYear: string;
  PassportIssueCountryCode: string;
}

export default function Profile({ user, onBack }: ProfileProps) {
  const { inputLang } = useDateLocale();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddPassenger, setShowAddPassenger] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [editingPassenger, setEditingPassenger] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fetchingPassengers, setFetchingPassengers] = useState(false);

  // Fetch passengers when passengers tab is accessed
  useEffect(() => {
    if (activeTab === "passengers" && user?.userId && passengers.length === 0) {
      fetchPassengers();
    }
  }, [activeTab, user?.userId]);

  const fetchPassengers = async () => {
    if (!user?.userId) return;
    
    setFetchingPassengers(true);
    try {
      const result = await passengerAPI.getPassengersByUserId(user.userId);
      
      if (result.response && Array.isArray(result.response)) {
        const fetchedPassengers: Passenger[] = result.response.map((p: any) => ({
          id: p.origin?.toString() || Date.now().toString(),
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          dateOfBirth: p.dateOfBirth || "",
          email: p.email || "",
          passportNationality: p.passportNationality?.toString() || "",
          passportNumber: p.passportNumber || "",
          passportExpiryDay: p.passportExpiryDay || "",
          passportExpiryMonth: p.passportExpiryMonth || "",
          passportExpiryYear: p.passportExpiryYear || "",
          PassportIssueCountryCode: p.PassportIssueCountryCode || "",
        }));
        setPassengers(fetchedPassengers);
      }
    } catch (error) {
      console.error("Failed to fetch passengers:", error);
    }
    setFetchingPassengers(false);
  };

  const handleAddPassenger = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    const formData = new FormData(e.currentTarget);
    
    const passengerData: PassengerData = {
      userId: user?.userId || 0,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      dateOfBirth: formData.get("dateOfBirth") as string,
      email: formData.get("email") as string,
      passportUserName: null,
      passportNationality: 0, // You may want to map country names to codes
      passportExpiryDay: formData.get("passportExpiryDay") as string,
      passportExpiryMonth: formData.get("passportExpiryMonth") as string,
      passportExpiryYear: formData.get("passportExpiryYear") as string,
      passportNumber: formData.get("passportNumber") as string,
      PassportIssueCountryCode: formData.get("PassportIssueCountryCode") as string,
    };
    
    try {
      const result = await passengerAPI.createPassenger(passengerData);
      
      if (result.status === "success" || result.response) {
        // Add to local state for immediate UI update
        const newPassenger: Passenger = {
          id: Date.now().toString(),
          firstName: passengerData.firstName,
          lastName: passengerData.lastName,
          dateOfBirth: passengerData.dateOfBirth || "",
          email: passengerData.email || "",
          passportNationality: formData.get("passportNationality") as string,
          passportNumber: passengerData.passportNumber || "",
          passportExpiryDay: passengerData.passportExpiryDay || "",
          passportExpiryMonth: passengerData.passportExpiryMonth || "",
          passportExpiryYear: passengerData.passportExpiryYear || "",
          PassportIssueCountryCode: passengerData.PassportIssueCountryCode || "",
        };
        
        setPassengers([...passengers, newPassenger]);
        setShowAddPassenger(false);
        setMessage("Passenger added successfully!");
      } else {
        setMessage("Failed to add passenger. Please try again.");
      }
    } catch (error) {
      console.error("Add passenger error:", error);
      setMessage("An error occurred. Please try again.");
    }
    
    setLoading(false);
  };

  const handleDeletePassenger = (id: string) => {
    setPassengers(passengers.filter(p => p.id !== id));
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "profile", label: "My Profile" },
    { id: "passengers", label: "Passengers" },
    { id: "bookings", label: "My Bookings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onBack}
              className="text-primary hover:text-primary-dark"
            >
              ← Back to Home
            </button>
            <h1 className="text-xl font-semibold">My Account</h1>
            <div></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "dashboard" && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900">Total Bookings</h3>
                    <p className="text-3xl font-bold text-blue-600">0</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900">Completed Trips</h3>
                    <p className="text-3xl font-bold text-green-600">0</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-900">Saved Passengers</h3>
                    <p className="text-3xl font-bold text-purple-600">0</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div>
                <h2 className="text-2xl font-bold mb-6">My Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.userName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.firstName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.lastName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Country Code</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{user?.countryCode}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">
                      {user?.createdOn ? formatUserDate(user.createdOn) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">
                      {user?.status === 0 ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "passengers" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Saved Passengers</h2>
                  <button 
                    onClick={() => setShowAddPassenger(true)}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
                  >
                    Add Passenger
                  </button>
                </div>

                {passengers.length === 0 && !showAddPassenger ? (
                  <div className="text-center py-12">
                    {fetchingPassengers ? (
                      <p className="text-gray-500">Loading passengers...</p>
                    ) : (
                      <p className="text-gray-500">No saved passengers yet.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {passengers.map((passenger) => (
                      <div key={passenger.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Name</label>
                              <p className="text-gray-900">{passenger.firstName} {passenger.lastName}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                              <p className="text-gray-900">{formatUserDate(passenger.dateOfBirth)}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Email</label>
                              <p className="text-gray-900">{passenger.email}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
                              <p className="text-gray-900">{passenger.passportNumber}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Nationality</label>
                              <p className="text-gray-900">{passenger.passportNationality}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Passport Expiry</label>
                              <p className="text-gray-900">{passenger.passportExpiryDay}/{passenger.passportExpiryMonth}/{passenger.passportExpiryYear}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePassenger(passenger.id)}
                            className="text-red-600 hover:text-red-800 ml-4"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Passenger Form */}
                {showAddPassenger && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Add New Passenger</h3>
                        <button
                          onClick={() => setShowAddPassenger(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>

                      {message && (
                        <div className={`mb-4 p-3 rounded ${
                          message.includes("success") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {message}
                        </div>
                      )}

                      <form onSubmit={handleAddPassenger} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            name="firstName"
                            placeholder="First Name"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <input
                            name="lastName"
                            placeholder="Last Name"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            name="dateOfBirth"
                            type="date"
                            lang={inputLang}
                            placeholder="Date of Birth"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <input
                            name="email"
                            type="email"
                            placeholder="Email"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            name="passportNationality"
                            placeholder="Passport Nationality"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <input
                            name="passportNumber"
                            placeholder="Passport Number"
                            required
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Passport Expiry Date</label>
                          <div className="grid grid-cols-3 gap-4">
                            <select
                              name="passportExpiryDay"
                              required
                              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">Day</option>
                              {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                                <option key={day} value={day.toString().padStart(2, '0')}>
                                  {day.toString().padStart(2, '0')}
                                </option>
                              ))}
                            </select>
                            <select
                              name="passportExpiryMonth"
                              required
                              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">Month</option>
                              {[
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                              ].map((month, index) => (
                                <option key={month} value={(index + 1).toString().padStart(2, '0')}>
                                  {month}
                                </option>
                              ))}
                            </select>
                            <select
                              name="passportExpiryYear"
                              required
                              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">Year</option>
                              {Array.from({length: 20}, (_, i) => new Date().getFullYear() + i).map(year => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <input
                          name="PassportIssueCountryCode"
                          placeholder="Passport Issuing Country"
                          required
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        />

                        <div className="flex space-x-4 pt-4">
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
                          >
                            {loading ? "Saving..." : "Save Passenger"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddPassenger(false)}
                            disabled={loading}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "bookings" && (
              <div>
                <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
                <div className="text-center py-12">
                  <p className="text-gray-500">No bookings found.</p>
                  <button 
                    onClick={onBack}
                    className="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}