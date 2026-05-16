
import * as style from 'ol/style';

export const highlightStyle = new style.Style({
    stroke: new style.Stroke({ color: '#00ffff', width: 4 }),
    fill: new style.Fill({ color: 'rgba(0, 255, 255, 0.2)' }),
    image: new style.Circle({ radius: 8, fill: new style.Fill({ color: '#00ffff' }), stroke: new style.Stroke({color: '#ffffff', width: 2}) })
});

export const locationStyle = (feature: any) => {
    const type = feature.get('type');
    if (type === 'accuracy') return new style.Style({ fill: new style.Fill({ color: 'rgba(59, 130, 246, 0.1)' }), stroke: new style.Stroke({ color: 'rgba(59, 130, 246, 0.3)', width: 1 }) });
    
    if (type === 'search_result') return new style.Style({ 
        image: new style.Circle({ 
            radius: 10, 
            fill: new style.Fill({ color: '#ef4444' }), 
            stroke: new style.Stroke({ color: '#ffffff', width: 3 }) 
        }),
        zIndex: 1000
    });

    return new style.Style({ image: new style.Circle({ radius: 8, fill: new style.Fill({ color: '#3b82f6' }), stroke: new style.Stroke({ color: '#fff', width: 3 }) }) });
};

export const measureStyle = new style.Style({
    fill: new style.Fill({ color: 'rgba(59, 130, 246, 0.2)' }),
    stroke: new style.Stroke({ color: '#3b82f6', lineDash: [10, 10], width: 3 }),
    image: new style.Circle({ radius: 5, stroke: new style.Stroke({ color: '#3b82f6', width: 2 }), fill: new style.Fill({ color: '#fff' }) })
});

export const smartMapProperties = (props: any) => {
    const findVal = (keys: string[]) => {
        for (const k of keys) {
            if (props[k] !== undefined && props[k] !== null && props[k] !== '') return props[k];
            const lower = k.toLowerCase();
            if (props[lower] !== undefined && props[lower] !== null && props[lower] !== '') return props[lower];
        }
        return null;
    };
    return {
        ...props,
        madinhdanh: findVal(['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier']),
        so_to: findVal(['sodoto', 'so_to', 'shbando', 'sh_ban_do', 'tobando', 'tờ', 'số tờ', 'so_to_ban_do']),
        so_thua: findVal(['sothua', 'so_thua', 'shthua', 'sh_thua', 'thửa', 'số thửa', 'so_thu_tu_thua']),
        ownerName: findVal(['tenchu', 'ten_chu', 'ten_chu_sd', 'owner', 'chủ sở hữu', 'chusudung']),
        area: parseFloat(findVal(['dientich', 'dien_tich', 'area', 'diện tích', 'shape_area', 'dt_phaply']) || 0),
        landType: findVal(['loaidat', 'kyhieumucd', 'mucdich', 'loại đất', 'mdsd']) || 'N/A',
        address: findVal(['diachi', 'dia_chi', 'dc', 'địa chỉ', 'vitri']) || '',
        imageUrl: findVal(['image_url', 'imageurl', 'hinhanh', 'hinh_anh', 'photo', 'picture'])
    };
};
