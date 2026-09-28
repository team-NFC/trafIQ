import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { anprService } from '../api/anpr';
import { VehicleJourney } from '../types/anpr';
import { PlateSearchBox } from '../components/anpr/PlateSearchBox';
import { VehicleDetails } from '../components/anpr/VehicleDetails';
import { JourneyTimeline } from '../components/anpr/JourneyTimeline';
import { DatabaseAlertCard } from '../components/anpr/DatabaseAlertCard';
import { PlateReadsTable } from '../components/anpr/PlateReadsTable';
import { EmptyState } from '../components/common/EmptyState';
import { Search, AlertCircle } from 'lucide-react';

export const PlateSearchPage: React.FC = () => {
  const { searchedPlate, setSearchedPlate, setCurrentPage, isDemoMode } = useApp();
  const [journey, setJourney] = useState<VehicleJourney | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchedText, setSearchedText] = useState(searchedPlate || 'TN45BB7890');

  const executeSearch = async (plate: string) => {
    setLoading(true);
    setSearchedText(plate);
    setSearchedPlate(plate);
    const res = await anprService.searchPlate(plate);
    setJourney(res.data);
    setLoading(false);
  };

  useEffect(() => {
    executeSearch(searchedText);
  }, [isDemoMode]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-fuchsia-400" />
          <span>VEHICLE SEARCH & SPATIO-TEMPORAL TRAJECTORY</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Query cross-camera license plate localization history, FIR records, and multi-hop transit paths
        </p>
      </div>

      {/* Interactive Search Bar */}
      <PlateSearchBox
        initialValue={searchedText}
        onSearch={executeSearch}
        isLoading={loading}
      />

      {/* Search Result View */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono">Querying multi-camera ANPR index for {searchedText}...</span>
        </div>
      ) : journey ? (
        <div className="space-y-6">
          {/* 3D Camera Tracking Link Banner */}
          <div className="p-3.5 rounded-xl bg-[#090d16]/95 border border-cyan-500/30 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <div className="text-xs font-mono">
                <span className="text-white font-bold">{journey.plateNumber}</span>
                <span className="text-slate-400 ml-2">spatio-temporal corridor ready for 3D reconstruction</span>
              </div>
            </div>
            <button
              onClick={() => setCurrentPage('camera_tracking')}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <span>Launch 3D Camera Tracking</span>
              <span>→</span>
            </button>
          </div>

          {/* Watchlist Match Card if vehicle is flagged */}
          {journey.databaseMatch?.isMatched && (
            <DatabaseAlertCard
              alert={{
                id: 'match-001',
                plate: journey.plateNumber,
                vehicleClass: journey.vehicleClass,
                recordType: 'FIR / Police Alert',
                cameraId: journey.observations[journey.observations.length - 1]?.cameraName || 'CAM 04',
                cameraName: journey.observations[journey.observations.length - 1]?.cameraName || 'CAM 04',
                location: journey.observations[journey.observations.length - 1]?.location || 'West Ring Road',
                detectionTime: journey.lastSeen,
                status: 'PENDING_REVIEW',
                details: journey.databaseMatch.alertDescription || 'Stored watchlist match flagged for review.'
              }}
            />
          )}

          {/* Vehicle Telemetry Profile Card */}
          <VehicleDetails journey={journey} />

          {/* Chronological Journey Timeline */}
          <JourneyTimeline journey={journey} />

          {/* Observation Log Table */}
          <PlateReadsTable observations={journey.observations} />
        </div>
      ) : (
        <EmptyState
          title="Vehicle Not Found in Active ANPR Index"
          message={`No camera observations recorded for plate "${searchedText}". Try searching a sample plate such as TN45BB7890 or DL01AB1234.`}
          icon={AlertCircle}
          actionText="Search Sample TN45BB7890"
          onAction={() => executeSearch('TN45BB7890')}
        />
      )}
    </div>
  );
};
