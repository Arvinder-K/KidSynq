import { useOutletContext } from 'react-router-dom';


const ClassroomOverview = () => {
    const { classroom } = useOutletContext<any>();

    return (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Classroom Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-500">Program</h3>
                    <p className="mt-1 text-sm text-gray-900">{classroom.program_name}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500">Age Group</h3>
                    <p className="mt-1 text-sm text-gray-900">{classroom.age_group_name}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500">Capacity</h3>
                    <p className="mt-1 text-sm text-gray-900">{classroom.capacity}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500">Status</h3>
                    <p className="mt-1 text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classroom.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {classroom.status}
                        </span>
                    </p>
                </div>
                {classroom.description && (
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500">Description</h3>
                        <p className="mt-1 text-sm text-gray-900">{classroom.description}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassroomOverview;
