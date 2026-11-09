try:
    import pymysql
    # Ensure MySQLdb version requirement check passes across all environments
    if hasattr(pymysql, 'version_info') and pymysql.version_info < (2, 2, 1):
        pymysql.version_info = (2, 2, 8, "final", 0)
    pymysql.install_as_MySQLdb()
except ImportError:
    pass
