import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PlantsTable from './components/PlantsTable';
import PlantFormDrawer from './components/PlantFormDrawer';
import CarouselShiftSheet from './components/CarouselShiftSheet';
import type { PlantFormValues, PlantRecord } from './types';
import { getApiErrorMessage, lpgCarouselsApi } from './services/lpgCarouselsApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/@/components/ui/alert-dialog';

const LPGCarousels: React.FC = () => {
  const [plants, setPlants] = useState<PlantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingPlant, setEditingPlant] = useState<PlantRecord | null>(null);
  const [carouselPlant, setCarouselPlant] = useState<PlantRecord | null>(null);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlantRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchPlants = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await lpgCarouselsApi.getAllPlants();
      setPlants(data);
      setLoading(false);
      setRefreshing(false);
      if (isRefresh) {
        toast.success('Plants refreshed.');
      }
      void lpgCarouselsApi.attachCarouselsToPlants(data).then((withCarousels) => {
        setPlants((prev) =>
          prev.map((plant) => {
            const updated = withCarousels.find((p) => p.sapErpId === plant.sapErpId);
            if (!updated) return plant;
            return {
              ...plant,
              carousels: updated.carousels,
              carouselCount: updated.carouselCount,
            };
          })
        );
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load plants.'));
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const handleAdd = () => {
    setFormMode('add');
    setEditingPlant(null);
    setFormOpen(true);
  };

  const handleEdit = (plant: PlantRecord) => {
    setFormMode('edit');
    setEditingPlant(plant);
    setFormOpen(true);
  };

  const handleFormSave = async (values: PlantFormValues) => {
    try {
      if (formMode === 'add') {
        await lpgCarouselsApi.createPlant(values);
        toast.success('Plant created successfully.');
      } else {
        await lpgCarouselsApi.updatePlant(values);
        toast.success('Plant updated successfully.');
      }
      await fetchPlants();
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          formMode === 'add' ? 'Failed to create plant.' : 'Failed to update plant.'
        )
      );
      throw error;
    }
  };

  const handleTestConnection = async (values: PlantFormValues) => {
    try {
      const isConnected = await lpgCarouselsApi.testPlantConnection(values);
      if (isConnected) {
        toast.success('Connection tested successfully.');
      } else {
        toast.error('Connection test failed.');
      }
      return isConnected;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Connection test failed.'));
      return false;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await lpgCarouselsApi.deletePlant(Number(deleteTarget.sapErpId));
      toast.success(`"${deleteTarget.plantName}" deleted.`);
      setDeleteTarget(null);
      await fetchPlants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete plant.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleViewCarousel = (plant: PlantRecord) => {
    setCarouselPlant(plant);
    setCarouselOpen(true);
  };

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await lpgCarouselsApi.downloadMasterData();
      toast.success('Master data downloaded.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to download master data.'));
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleCarouselRefresh = async () => {
    if (!carouselPlant) return;
    const carousels = await lpgCarouselsApi.getCarouselsForPlant(Number(carouselPlant.sapErpId));
    const updated: PlantRecord = {
      ...carouselPlant,
      carousels,
      carouselCount: carousels.length,
    };
    setCarouselPlant(updated);
    setPlants((prev) =>
      prev.map((p) => (p.sapErpId === carouselPlant.sapErpId ? updated : p))
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-3 py-3">
        <PlantsTable
          plants={plants}
          loading={loading}
          refreshing={refreshing}
          onAdd={handleAdd}
          onRefresh={() => fetchPlants(true)}
          onDownload={handleDownload}
          downloading={downloading}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onViewCarousel={handleViewCarousel}
        />
      </main>

      <PlantFormDrawer
        open={formOpen}
        mode={formMode}
        plant={editingPlant}
        onOpenChange={setFormOpen}
        onSave={handleFormSave}
        onTestConnection={handleTestConnection}
      />

      <CarouselShiftSheet
        open={carouselOpen}
        plant={carouselPlant}
        onOpenChange={setCarouselOpen}
        onRefresh={handleCarouselRefresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.plantName}</strong> and its carousel
              configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LPGCarousels;
