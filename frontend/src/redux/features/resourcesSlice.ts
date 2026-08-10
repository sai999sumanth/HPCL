import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Resource } from '../../types/cloudCost';
import { apiClient } from '@/services/apiClient';
import { encryptPayload } from '@/configs/encryptFernet';

interface ResourcesState {
    allData: Resource[];
    displayedData: Resource[];
    loading: boolean;
    error: string | null;
    filters: Record<string, any>;
    page: number;
    pageSize: number;
    totalItems: number;
    orderBy: keyof Resource | 'pool';
    order: 'asc' | 'desc';
    filterOptions: Record<string, string[]>;
    resourceDetails: Resource | null;
    lastFetchedOrganizationId: string | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    lastFetchTime: number | null;
}

type QueryParam = { 
    key: string;
    value: string | number | string[];
    condition: string;
};

const initialState: ResourcesState = {
    allData: [],
    displayedData: [],
    loading: false,
    error: null,
    filters: {},
    page: 1,
    pageSize: 10,
    totalItems: 0,
    orderBy: 'cloud_account_id',
    order: 'asc',
    filterOptions: {},
    resourceDetails: null,
    status: 'idle',
    lastFetchedOrganizationId: null,
    lastFetchTime: null,
};

export const fetchResources = createAsyncThunk(
    'resources/fetchResources',
    async ({ organizationId }: { organizationId: number }, { getState }) => {
        const { lastFetchedOrganizationId, lastFetchTime, allData, filters } = (getState() as { resources: ResourcesState }).resources;
        const oneHour = 60 * 60 * 1000;
          let selectFilter="";
          
        // Check if filters.resource_state is defined and is an array
        if (Array.isArray(filters.resource_state)) {
            console.log("tttt", filters.resource_state.join(","));
            selectFilter=String(filters.resource_state.join(","));
            console.log("selectFilter",selectFilter)
        } else {
            console.log("tttt", "resource_state is not an array or undefined");
        }
        console.log("var",selectFilter)
    
        if (organizationId === Number(lastFetchedOrganizationId) && Date.now() - (lastFetchTime ?? 0) < oneHour) {
            return { resources: allData };
        }
        
        const params: QueryParam[] = [
            { key: "organization_id", value: selectFilter || 6, condition: "=" }
        ];

        const queryParams = new URLSearchParams({
            q: JSON.stringify(params),
            limit: '100',
            view: 'resources'
        });
        let encryptedQueryParams = encryptPayload(queryParams);
        const response = await apiClient.get(`/api/resources/views/resource_view?${encryptedQueryParams}`);
        if (!response.status) {
            throw new Error('Failed to fetch resources');
        }
        const resourcesData = response.data;
        return { resources: resourcesData };
    }
);
export const fetchResourceDetails = createAsyncThunk(
    'resources/fetchResourceDetails',
    async (id: number) => {
        let encryptedResourceId = encryptPayload(id);
        const response = await apiClient.get(`/api/resources/${encryptedResourceId}`);
        if (!response.status) {
            throw new Error('Failed to fetch resource details');
        }
        const data = await response.data;
        return data;
    }
);

export const fetchFilterOptions = createAsyncThunk(
    'resources/fetchFilterOptions',
    async (organizationId: number) => {
        const response = await apiClient.post('/api/charts/get_distinct_values', {
                table: "resources",
                column: [
                    "cloud_provider", "region", "region_name", "resource_state",
                    "cloud_account_name", "resource_size", "reservation_type",
                    "resource_type", "os_type", "subnet_id", "vpc_id",
                    "owner", "environment", "project"
                ],
                where_cond: { "organization_id": organizationId }
            });
        if (!response.status) {
            throw new Error('Failed to fetch filter options');
        }

        const data = response.data;
        return data.data;
    }
);

const resourcesSlice = createSlice({
    name: 'resources',
    initialState,
    reducers: {
        setFilters: (state, action: PayloadAction<Record<string, any>>) => {
            state.filters = action.payload;
            applyFiltersAndPagination(state);
        },
        setPage: (state, action: PayloadAction<number>) => {
            state.page = action.payload;
            applyFiltersAndPagination(state);
        },
        setPageSize: (state, action: PayloadAction<number>) => {
            state.pageSize = action.payload;
            applyFiltersAndPagination(state);
        },
        setOrderBy: (state, action: PayloadAction<keyof Resource | 'pool'>) => {
            state.orderBy = action.payload;
            applyFiltersAndPagination(state);
        },
        setOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
            state.order = action.payload;
            applyFiltersAndPagination(state);
        },
        setLoadingStatus: (state) => {
            state.status = 'loading';
        },
    },
    extraReducers: (builder) => {
        builder
            // Handle fetchResources
            .addCase(fetchResources.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchResources.fulfilled, (state, action) => {
                state.loading = false;
                state.allData = action.payload.resources.data;
                state.totalItems = action.payload.resources.total;
                state.lastFetchTime = Date.now();
                applyFiltersAndPagination(state);
            })
            .addCase(fetchResources.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch resources';
            })
            
            // Handle fetchResourceDetails
            .addCase(fetchResourceDetails.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchResourceDetails.fulfilled, (state, action) => {
                state.loading = false;
                state.resourceDetails = action.payload;
            })
            .addCase(fetchResourceDetails.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch resource details';
            })
            
            // Handle fetchFilterOptions
            .addCase(fetchFilterOptions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchFilterOptions.fulfilled, (state, action) => {
                state.loading = false;
                state.filterOptions = action.payload;
            })
            .addCase(fetchFilterOptions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch filter options';
            });
    },
});

const applyFiltersAndPagination = (state: ResourcesState) => {
    let filteredData = [...state.allData]; // Start with all data

    // Apply filters
    Object.entries(state.filters).forEach(([key, value]) => {
        if (value) {
            filteredData = filteredData.filter(item => {
                const itemValue = item[key as keyof Resource];

                if (Array.isArray(value)) {
                    // Check if the value array includes the itemValue (for multi-select filters)
                    return value.includes(itemValue);
                } else if (typeof value === 'string') {
                    // Case-insensitive string matching
                    return itemValue.toString().toLowerCase().includes(value.toLowerCase());
                } else if (typeof value === 'number') {
                    // Number matching
                    return itemValue === value;
                }
                return false; // Default case
            });
        }
    });

    // Apply sorting
    filteredData.sort((a, b) => {
        const aValue = a[state.orderBy];
        const bValue = b[state.orderBy];
        if (aValue < bValue) return state.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return state.order === 'asc' ? 1 : -1;
        return 0;
    });

    // Update total items
    state.totalItems = filteredData.length;

    // Apply pagination
    const startIndex = (state.page - 1) * state.pageSize;
    state.displayedData = filteredData.slice(startIndex, startIndex + state.pageSize);
};


export const { setFilters, setPage, setPageSize, setOrderBy, setOrder, setLoadingStatus } = resourcesSlice.actions;

export default resourcesSlice.reducer;


