import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { WebView } from 'react-native-webview';

interface LocationItem {
  _id: string;
  id?: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  radius?: number;
  status?: string;
}

const getMapHtml = (lat: number, lng: number) => {
  const safeLat = isNaN(lat) || lat === 0 ? 17.3850 : lat;
  const safeLng = isNaN(lng) || lng === 0 ? 78.4867 : lng;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
  <style>
    html, body { padding: 0; margin: 0; height: 100%; width: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    #map { position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 1; }
    #search-box {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 1000;
      background: white;
      padding: 6px;
      border-radius: 20px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      border: 1px solid #E5E7EB;
    }
    #search-input {
      flex: 1;
      border: none;
      padding: 8px 12px;
      font-size: 14px;
      outline: none;
      background: transparent;
    }
    #search-button {
      background: #FF5100;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="search-box">
    <input type="text" id="search-input" placeholder="Search stadium, court, or field..." />
    <button id="search-button">Search</button>
  </div>
  <div id="map"></div>
  
  <script>
    window.onload = function() {
      if (typeof L === 'undefined') {
        return;
      }
      
      var initLat = ${safeLat};
      var initLng = ${safeLng};
      
      var map = L.map('map', { zoomControl: false }).setView([initLat, initLng], 16);
      
      // Load Google Maps Hybrid Tiles (Satellite + labels)
      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google'
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      var marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);

      // Perform initial geocode for display
      reverseGeocode(initLat, initLng);

      document.getElementById('search-button').addEventListener('click', performSearch);
      document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
      });

      function performSearch() {
        var query = document.getElementById('search-input').value;
        if (!query) return;
        
        fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&email=arenova-app@example.com&q=' + encodeURIComponent(query))
          .then(response => response.json())
          .then(data => {
            if (data && data.length > 0) {
              var searchLat = parseFloat(data[0].lat);
              var searchLon = parseFloat(data[0].lon);
              
              map.setView([searchLat, searchLon], 17);
              marker.setLatLng([searchLat, searchLon]);
              
              processNominatimResult(data[0]);
            }
          })
          .catch(err => {
            console.error('Search error:', err);
          });
      }

      marker.on('dragend', function(e) {
        var pos = marker.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      function reverseGeocode(lat, lng) {
        // Send loading status to React Native immediately while fetching address
        sendToApp(lat, lng, 'Selected Venue', 'City', 'Fetching address details...');
        
        fetch('https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&email=arenova-app@example.com&lat=' + lat + '&lon=' + lng)
          .then(response => response.json())
          .then(data => {
            processNominatimResult(data);
          })
          .catch(err => {
            sendToApp(lat, lng, 'Selected Venue', 'City', lat.toFixed(4) + ', ' + lng.toFixed(4));
          });
      }

      function processNominatimResult(result) {
        var rLat = parseFloat(result.lat);
        var rLng = parseFloat(result.lon);
        var displayName = result.display_name || '';
        var addressData = result.address || {};
        
        var city = addressData.city || addressData.town || addressData.village || addressData.suburb || addressData.county || '';
        var name = addressData.amenity || addressData.stadium || addressData.sports_centre || addressData.leisure || addressData.building || addressData.tourism || addressData.industrial || '';
        
        var road = addressData.road || '';
        
        if (!name) {
          name = road ? road : 'Coaching Spot';
        }
        
        sendToApp(rLat, rLng, name, city, displayName);
      }

      function sendToApp(lat, lng, name, city, address) {
        var msg = {
          latitude: lat,
          longitude: lng,
          name: name,
          city: city,
          address: address
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    };
  </script>
</body>
</html>
  `;
};

export default function LocationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedLocationId, setSelectedLocationId } = useAuthStore();

  const [screenMode, setScreenMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [tempMapData, setTempMapData] = useState<any>(null);
  const [mapInitCoords, setMapInitCoords] = useState<{lat: number, lng: number} | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('50');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const { data: locationsResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['coachLocations'],
    queryFn: async () => {
      const res = await api.get('/coach-app/locations');
      return res.data;
    }
  });

  const locations: LocationItem[] = locationsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/coach-app/locations', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coachLocations'] });
      const newLocId = data?.data?._id || data?.data?.id || data?._id || data?.id;
      if (!selectedLocationId && newLocId) {
        setSelectedLocationId(newLocId);
      }
      setSubmitError(null);
      closeForm();
      Alert.alert('Success', 'Coaching location created successfully!');
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to create location');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/coach-app/locations/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachLocations'] });
      setSubmitError(null);
      closeForm();
      Alert.alert('Success', 'Coaching location updated successfully!');
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to update location');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/coach-app/locations/${id}`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['coachLocations'] });
      if (selectedLocationId === id) {
        setSelectedLocationId(null);
      }
      setListError(null);
      Alert.alert('Success', 'Location deactivated successfully.');
    },
    onError: (err: any) => {
      setListError(err.response?.data?.message || err.message || 'Failed to deactivate location');
    }
  });

  const openAddScreen = () => {
    resetFields();
    setScreenMode('add');
  };

  const openEditScreen = (loc: LocationItem) => {
    resetFields();
    setEditingId(loc._id || loc.id || null);
    setName(loc.name);
    setAddress(loc.address);
    setCity(loc.city);
    setLatitude(loc.latitude?.toString() || '0');
    setLongitude(loc.longitude?.toString() || '0');
    setRadius(loc.radius?.toString() || '50');
    setScreenMode('edit');
  };

  const closeForm = () => {
    setScreenMode('list');
    resetFields();
  };

  const resetFields = () => {
    setName('');
    setAddress('');
    setCity('');
    setLatitude('');
    setLongitude('');
    setRadius('50');
    setErrors({});
    setTempMapData(null);
    setSubmitError(null);
    setListError(null);
    setMapInitCoords(null);
    setEditingId(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Location name is required';
    if (!address.trim()) newErrors.address = 'Address is required';
    if (!city.trim()) newErrors.city = 'City is required';
    
    if (latitude.trim() && isNaN(Number(latitude))) newErrors.latitude = 'Latitude must be a number';
    if (longitude.trim() && isNaN(Number(longitude))) newErrors.longitude = 'Longitude must be a number';
    if (radius.trim() && isNaN(Number(radius))) newErrors.radius = 'Radius must be a number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      latitude: parseFloat(latitude) || 0,
      longitude: parseFloat(longitude) || 0,
      radius: parseFloat(radius) || 50,
      status: 'active'
    };

    if (screenMode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Deactivate Location',
      'Deactivating this location will cancel future availability slots booked here. Are you sure you want to deactivate it?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Deactivate', 
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id)
        }
      ]
    );
  };

  const handleSelectLocation = (id: string) => {
    setSelectedLocationId(id);
    Alert.alert('Live Location Updated', 'Your active coaching location has been set!');
  };

  const openMapPicker = () => {
    const initialLat = parseFloat(latitude) || 17.3850;
    const initialLng = parseFloat(longitude) || 78.4867;

    setMapInitCoords({
      lat: initialLat,
      lng: initialLng
    });
    setMapModalVisible(true);
  };

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.latitude) {
        setTempMapData(data);
      }
    } catch (e) {
      console.error('Failed to parse map data:', e);
    }
  };

  const confirmMapSelection = () => {
    if (tempMapData) {
      setName(tempMapData.name || '');
      setCity(tempMapData.city || '');
      setAddress(tempMapData.address || '');
      setLatitude(tempMapData.latitude?.toString() || '0');
      setLongitude(tempMapData.longitude?.toString() || '0');
      setMapModalVisible(false);
      setTempMapData(null);
    }
  };

  if (screenMode === 'list') {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-4 flex-row items-center bg-white border-b border-gray-100 shadow-sm z-10">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-4">
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
            Coaching Locations
          </Typography>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {listError && (
            <View className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm">
              <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                  Deactivation Failed
                </Typography>
                <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                  {listError}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setListError(null)} className="p-1 -mr-1 -mt-1">
                <Ionicons name="close" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Helper Banner */}
          <View className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-5 flex-row">
            <Ionicons name="information-circle" size={20} color="#FF5100" className="mr-3 mt-0.5" />
            <Typography variant="body2" color="text" className="flex-1 leading-5 font-outfit-medium">
              Tap a location below to set it as your active <Typography variant="body2" color="primary" weight="bold">Live Location</Typography>. Your current live location displays on your dashboard.
            </Typography>
          </View>

          {/* Locations List */}
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#FF5100" />
            </View>
          ) : locations.length === 0 ? (
            <View className="items-center justify-center py-16 px-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
                <Ionicons name="location-outline" size={32} color="#9CA3AF" />
              </View>
              <Typography variant="subtitle1" color="secondary" weight="semibold" className="mb-1 font-outfit-semibold">
                No Locations Added
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="mb-6">
                Add the fields, courts, or stadiums where you actively coach so clients can book you there.
              </Typography>
              <Button title="Add Location" onPress={openAddScreen} variant="primary" size="sm" fullWidth={false} className="px-6" />
            </View>
          ) : (
            locations.map((loc) => {
              const isSelected = selectedLocationId === loc._id || selectedLocationId === loc.id;
              return (
                <TouchableOpacity
                  key={loc._id || loc.id}
                  onPress={() => handleSelectLocation(loc._id || loc.id || '')}
                  activeOpacity={0.8}
                  className={`bg-white rounded-2xl p-4 mb-4 shadow-sm border-2 flex-row items-center justify-between transition-all ${
                    isSelected ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <View className="flex-row items-center flex-1 mr-4">
                    {/* Select indicator */}
                    <View className="mr-3">
                      <Ionicons 
                        name={isSelected ? "checkbox-sharp" : "square-outline"} 
                        size={24} 
                        color={isSelected ? "#FF5100" : "#9CA3AF"} 
                      />
                    </View>

                    <View className="flex-1">
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                        {loc.name}
                      </Typography>
                      <Typography variant="body2" color="text" className="font-outfit mb-0.5">
                        {loc.address}
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit">
                        {loc.city} {loc.latitude && loc.longitude ? `(${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})` : ''}
                      </Typography>
                    </View>
                  </View>

                  {/* Action buttons */}
                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity 
                      onPress={() => openEditScreen(loc)}
                      className="p-2 bg-gray-50 rounded-full"
                    >
                      <Ionicons name="create-outline" size={18} color="#0F2C59" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(loc._id || loc.id || '')}
                      className="p-2 bg-red-50 rounded-full ml-1"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Floating Sticky Add Button */}
        {locations.length > 0 && (
          <View className="absolute left-4 right-4 z-10 shadow-md" style={{ bottom: Math.max(insets.bottom + 16, 24) }}>
            <Button 
              title="Add New Location" 
              onPress={openAddScreen} 
              leftIcon={<Ionicons name="add" size={20} color="white" />}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Form Header */}
      <View className="px-4 py-4 flex-row items-center justify-between border-b border-gray-100 shadow-sm z-10 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={closeForm} className="p-2 -ml-2 mr-4">
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
            {screenMode === 'edit' ? 'Edit Location' : 'Add Location'}
          </Typography>
        </View>
        <TouchableOpacity 
          onPress={closeForm} 
          className="p-1.5 bg-gray-100 rounded-full active:opacity-75"
        >
          <Ionicons name="close" size={20} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-white"
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-5 pt-6"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}
        >
          {submitError && (
            <View className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm animate-fade-in">
              <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                  Save Failed
                </Typography>
                <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                  {submitError}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setSubmitError(null)} className="p-1 -mr-1 -mt-1">
                <Ionicons name="close" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Helper instructions */}
          <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex-row">
            <Ionicons name="map" size={20} color="#3B82F6" className="mr-3 mt-0.5" />
            <Typography variant="body2" color="text" className="flex-1 leading-5 font-outfit-medium">
              We recommend using <Typography variant="body2" color="primary" weight="bold">Pin Location on Map</Typography> first. Selecting your stadium or field on the map will automatically geocode and fill in the fields below.
            </Typography>
          </View>

          {/* Pin on Map Button */}
          <View className="mb-6">
            <Button 
              title="Pin Location on Map" 
              variant="outline" 
              size="md"
              leftIcon={<Ionicons name="map-outline" size={18} color="#FF5100" />}
              onPress={openMapPicker}
            />
          </View>

          <TextInput
            label="Location Name (e.g. Eldorado Court)"
            placeholder="Enter location name (auto-filled from map)"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <TextInput
            label="Address (e.g. 101 Stadium Road)"
            placeholder="Enter street address (auto-filled from map)"
            value={address}
            onChangeText={setAddress}
            error={errors.address}
          />

          <TextInput
            label="City"
            placeholder="Enter city (auto-filled from map)"
            value={city}
            onChangeText={setCity}
            error={errors.city}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextInput
                label="Latitude"
                placeholder="0.0"
                keyboardType="numeric"
                value={latitude}
                onChangeText={setLatitude}
                error={errors.latitude}
                editable={false}
                className="opacity-70"
                  />
                </View>
            <View className="flex-1">
              <TextInput
                label="Longitude"
                placeholder="0.0"
                keyboardType="numeric"
                value={longitude}
                onChangeText={setLongitude}
                error={errors.longitude}
                editable={false}
                className="opacity-70"
              />
            </View>
          </View>

          {screenMode === 'edit' && (
            <TextInput
              label="Radius (Meters)"
              placeholder="50"
              keyboardType="numeric"
              value={radius}
              onChangeText={setRadius}
              error={errors.radius}
            />
          )}

          <View className="mt-8">
            <Button 
              title={screenMode === 'edit' ? 'Save Changes' : 'Create Location'} 
              onPress={handleSubmit} 
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Map Picker Modal */}
      <Modal
        animationType="slide"
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          {/* Map Header */}
          <View className="px-4 py-4 flex-row items-center justify-between border-b border-gray-100 shadow-sm z-10 bg-white">
            <TouchableOpacity onPress={() => setMapModalVisible(false)} className="p-2 -ml-2 mr-4">
              <Ionicons name="arrow-back" size={24} color="#0F2C59" />
            </TouchableOpacity>
            <Typography variant="subtitle1" color="secondary" weight="bold" className="flex-1 font-outfit-bold">
              Pin Venue on Map
            </Typography>
          </View>

          {/* Map View Container */}
          <View className="flex-1 relative">
            {mapInitCoords && (
              <WebView
                source={{ html: getMapHtml(mapInitCoords.lat, mapInitCoords.lng) }}
                style={{ flex: 1 }}
                onMessage={handleMapMessage}
                geolocationEnabled={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
              />
            )}

            {/* Bottom Premium Card Overlay */}
            <View className="absolute left-4 right-4 bg-white rounded-2xl p-4 shadow-lg border border-gray-100 z-20" style={{ bottom: Math.max(insets.bottom + 16, 24) }}>
              <View className="flex-row items-start mb-4">
                <Ionicons name="location-sharp" size={20} color="#FF5100" className="mr-2 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                    {tempMapData && tempMapData.address !== 'Fetching address details...' ? tempMapData.name : 'Selected Location'}
                  </Typography>
                  <Typography variant="caption" color="text" className="font-outfit text-gray-500 leading-4" numberOfLines={2}>
                    {tempMapData?.address || "Tap map or search to select venue..."}
                  </Typography>
                </View>
              </View>

              <Button 
                title="Confirm Venue Selection" 
                onPress={confirmMapSelection} 
                disabled={!tempMapData || tempMapData.address === 'Fetching address details...'}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
