import { Dispatch, RefObject, SetStateAction, useEffect, useState } from 'react';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Map from 'ol/Map';
import Select from 'ol/interaction/Select';
import { Vector as VectorSource } from 'ol/source';
import { isEmpty as isExtentEmpty } from 'ol/extent';
import { gisService } from '../services/apiClient';

type DialogState = { isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; };

type UseEditorParcelSearchArgs = {
    editSource: RefObject<VectorSource>;
    mapInstance: RefObject<Map | null>;
    selectInteraction: RefObject<Select | null>;
    targetTable: string;
    setTargetTable: Dispatch<SetStateAction<string>>;
    setDialog: Dispatch<SetStateAction<DialogState>>;
    setIsMapLoading: Dispatch<SetStateAction<boolean>>;
    updateSelectionState: (primary?: Feature | null) => void;
    updateVerticesFromFeature: (feature: Feature | null) => void;
    updateFeatureListState: () => void;
    setSoTo: Dispatch<SetStateAction<string>>;
    setSoThua: Dispatch<SetStateAction<string>>;
    setLoaiDat: Dispatch<SetStateAction<string>>;
};

export const useEditorParcelSearch = ({
    editSource,
    mapInstance,
    selectInteraction,
    targetTable,
    setTargetTable,
    setDialog,
    setIsMapLoading,
    updateSelectionState,
    updateVerticesFromFeature,
    updateFeatureListState,
    setSoTo,
    setSoThua,
    setLoaiDat
}: UseEditorParcelSearchArgs) => {
    const [parcelModal, setParcelModal] = useState({ isOpen: false, soTo: '', soThua: '', phuongXa: '', searchTable: '', includeNearby: false, nearbyRadiusMeters: '50' });
    const [loadingParcel, setLoadingParcel] = useState(false);
    const [parcelList, setParcelList] = useState<any[]>([]);
    const [wardList, setWardList] = useState<string[]>([]);
    const [loadingWards, setLoadingWards] = useState(false);

    useEffect(() => {
        const loadWards = async () => {
            try {
                setLoadingWards(true);
                const wards = await gisService.getWardsFromParcels();
                setWardList(wards || []);
            } catch {
                setWardList([]);
            } finally {
                setLoadingWards(false);
            }
        };
        loadWards();
    }, []);

// Xử lý tra cứu thông tin thửa đất
const handleSearchParcel = async (overrideSoTo?: string, overrideSoThua?: string) => {
    const soTo = (overrideSoTo !== undefined ? overrideSoTo : parcelModal.soTo).trim();
    const soThua = (overrideSoThua !== undefined ? overrideSoThua : parcelModal.soThua).trim();
    const targetTable = parcelModal.searchTable.trim();

    if (!targetTable) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng chọn bảng dữ liệu để tra cứu.' });
        return;
    }

    if (!soTo && !soThua) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng nhập số tờ hoặc số thửa.' });
        return;
    }

    setLoadingParcel(true);
    setParcelList([]);
    try {
        const filters: any = {};
        if (soTo) filters.sodoto = soTo;
        if (soThua) filters.sothua = soThua;

        const parcels = await gisService.searchParcels(targetTable, filters);

        if (!parcels || parcels.length === 0) {
            let msg = 'Không tìm thấy thửa đất với điều kiện:';
            if (soTo) msg += ` Tờ ${soTo}`;
            if (soThua) msg += ` Thửa ${soThua}`;
            throw new Error(msg);
        }

        setParcelList(parcels);
        setParcelModal({ ...parcelModal, isOpen: true });

    } catch (e: any) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message || 'Không thể tra cứu thông tin thửa.' });
    } finally {
        setLoadingParcel(false);
    }
};

// Chọn thửa từ danh sách kết quả
const handleSelectParcel = async (parcel: any) => {
    setIsMapLoading(true);
    try {
        const props = parcel.properties || {};
        const soTo = props.so_to || props.sodoto || '';
        const soThua = props.so_thua || props.sothua || '';
        const loaiDat = props.loai_dat || props.loaidat || '';
        const sourceGid = Number(props.gid ?? props.id);
        const sourceTableName = String(props.tableName || props.table_name || '').trim();
        const geometry = parcel.geometry;

        if (!geometry) {
            throw new Error('Không có dữ liệu hình học cho thửa đất này.');
        }

        const format = new GeoJSON();
        const olFeature = format.readFeature(geometry, {
            dataProjection: 'EPSG:9210',
            featureProjection: 'EPSG:3857'
        }) as Feature;

        if (!olFeature) {
            throw new Error('Không thể đọc hình học từ dữ liệu thửa đất.');
        }

        olFeature.set('sodoto', soTo);
        olFeature.set('sothua', soThua);
        olFeature.set('loaidat', loaiDat);
        if (Number.isFinite(sourceGid) && sourceGid > 0) {
            olFeature.set('gid', sourceGid);
        }
        if (sourceTableName) {
            olFeature.set('source_table', sourceTableName);
        }
        olFeature.set('is_primary', true);
        olFeature.set('is_nearby', false);

        editSource.current.clear();
        editSource.current.addFeature(olFeature);
        selectInteraction.current?.getFeatures().clear();
        selectInteraction.current?.getFeatures().push(olFeature);
        updateSelectionState(olFeature);
        updateVerticesFromFeature(olFeature);
        updateFeatureListState();

        setSoTo(soTo);
        setSoThua(soThua);
        setLoaiDat(loaiDat);
        if (sourceTableName) {
            setTargetTable(sourceTableName);
        }

        if (parcelModal.includeNearby && Number.isFinite(sourceGid) && sourceGid > 0) {
            const radius = Number(parcelModal.nearbyRadiusMeters || '50');
            if (!Number.isFinite(radius) || radius <= 0) {
                throw new Error('Bán kính lân cận không hợp lệ.');
            }
            const nearbyParcels = await gisService.searchNearbyParcels(sourceTableName || targetTable || parcelModal.searchTable, {
                gid: sourceGid,
                radius,
                includeSelf: true
            });
            if (nearbyParcels.length > 0) {
                const nearbyFeatures = nearbyParcels
                    .map((p: any) => {
                        const pProps = p.properties || {};
                        const pSoTo = pProps.so_to || pProps.sodoto || '';
                        const pSoThua = pProps.so_thua || pProps.sothua || '';
                        const pLoaiDat = pProps.loai_dat || pProps.loaidat || pProps.landType || '';
                        const pSourceGid = Number(pProps.gid ?? pProps.id);
                        const pGeometry = p.geometry;
                        const pSourceTableName = String(pProps.tableName || pProps.table_name || sourceTableName || targetTable || parcelModal.searchTable || '').trim();

                        if (!pGeometry) return null;
                        const f = format.readFeature(pGeometry, {
                            dataProjection: 'EPSG:9210',
                            featureProjection: 'EPSG:3857'
                        }) as Feature;
                        if (!f) return null;

                        f.set('sodoto', pSoTo);
                        f.set('sothua', pSoThua);
                        f.set('loaidat', pLoaiDat);
                        if (Number.isFinite(pSourceGid) && pSourceGid > 0) {
                            f.set('gid', pSourceGid);
                        }
                        if (pSourceTableName) {
                            f.set('source_table', pSourceTableName);
                        }
                        const isPrimary = Number.isFinite(pSourceGid) && pSourceGid > 0 && pSourceGid === sourceGid;
                        f.set('is_primary', isPrimary);
                        f.set('is_nearby', !isPrimary);
                        return f;
                    })
                    .filter(Boolean) as Feature[];

                if (nearbyFeatures.length > 0) {
                    editSource.current.clear();
                    editSource.current.addFeatures(nearbyFeatures);
                    const selectedByGid = nearbyFeatures.find((f) => Number(f.get('gid')) === sourceGid) || nearbyFeatures[0];
                    if (selectedByGid) {
                        selectInteraction.current?.getFeatures().clear();
                        selectInteraction.current?.getFeatures().push(selectedByGid);
                        updateSelectionState(selectedByGid);
                        updateVerticesFromFeature(selectedByGid);
                    }
                    updateFeatureListState();
                }
            }
        }

        const extent = editSource.current.getExtent();
        if (!isExtentEmpty(extent)) {
            mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 800, maxZoom: 20 });
        }

        setParcelModal({ ...parcelModal, isOpen: false, soTo: '', soThua: '', searchTable: '' });
        setParcelList([]);
    } catch (e: any) {
        console.error('Lỗi khi chọn thửa đất:', e);
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message || 'Không thể chọn thửa đất. Vui lòng thử lại.' });
    } finally {
        setIsMapLoading(false);
    }
};

    return {
        parcelModal,
        setParcelModal,
        loadingParcel,
        parcelList,
        setParcelList,
        wardList,
        loadingWards,
        handleSearchParcel,
        handleSelectParcel
    };
};
