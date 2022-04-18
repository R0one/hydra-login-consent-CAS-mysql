if (process && process.env && ('CAS_URL' in process.env === false))
	throw new Error('you must provide to the nodejs process a base URL for the CAS server using the CAS_URL environment variable')

const casConfig = {
	CAS_URL: '' || process.env.CAS_URL
}	
export { casConfig }
